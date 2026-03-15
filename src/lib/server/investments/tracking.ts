import {
	createInvestmentHoldingSnapshot,
	listInvestmentHoldings,
	updateInvestmentHolding,
} from '$lib/server/investments/repository';
import type { InvestmentHolding } from '$lib/server/investments/types';

interface NordeaQuote {
	priceDate: string;
	unitPrice: number;
}

interface AvanzaSearchHit {
	title: string;
	orderBookId: string;
	urlSlugName: string | null;
}

interface AvanzaSearchResponse {
	hits: AvanzaSearchHit[];
}

interface AvanzaGuideResponse {
	name: string;
	nav: number;
	navDate: string;
}

interface RefreshHoldingResult {
	holdingId: string;
	name: string;
	currentValue: number;
	unitPrice: number;
	priceDate: string;
}

const nordeaUrlByHoldingName: Record<string, string> = {
	'Nordea Emerging Markets Enhanced BP':
		'https://www.nordeafunds.com/sv/fonder/emerging-markets-enhanced-bp',
	'Nordea Europa Index Select A': 'https://www.nordeafunds.com/sv/fonder/europa-index-select-a',
	'Nordea Global Index Select A': 'https://www.nordeafunds.com/sv/fonder/global-index-select-a',
	'Nordea Sverige Passiv': 'https://www.nordeafunds.com/sv/fonder/sverige-passiv-a-a',
};

const avanzaSlugByHoldingName: Record<string, string> = {
	'Avanza Global': 'avanza-global',
	'Avanza Emerging Markets': 'avanza-emerging-markets',
};

function parseNordeaDecimal(value: string): number {
	return Number.parseFloat(value.replace(/\./g, '').replace(/\s+/g, '').replace(',', '.'));
}

function toIsoDate(dayMonth: string): string {
	const [dayString, monthString] = dayMonth.split('.');
	const day = Number.parseInt(dayString, 10);
	const month = Number.parseInt(monthString, 10);
	const year = new Date().getUTCFullYear();

	return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

async function fetchNordeaQuote(url: string): Promise<NordeaQuote> {
	const response = await fetch(url, {
		headers: {
			'user-agent': 'Mozilla/5.0 FinDash/1.0',
			accept: 'text/html,application/xhtml+xml',
		},
	});

	if (!response.ok) {
		throw new Error(`Nordea request failed with ${response.status}`);
	}

	const html = await response.text();
	const match = html.match(
		/<div class="title">Kurs \(per ([0-9]{2}\.[0-9]{2})\.\)<\/div>\s*<div class="value">([0-9\s.,]+)<\/div>/i,
	);

	if (!match) {
		throw new Error('Could not parse Nordea quote');
	}

	return {
		priceDate: toIsoDate(match[1]),
		unitPrice: parseNordeaDecimal(match[2]),
	};
}

function persistRefreshedHolding(
	holding: InvestmentHolding,
	input: {
		currentValue: number;
		unitPrice: number;
		units: number;
		priceDate: string;
		trackerUrl: string;
	},
): RefreshHoldingResult {
	const syncedAt = new Date().toISOString();

	updateInvestmentHolding(holding.id, {
		currentValue: input.currentValue,
		units: input.units,
		latestUnitPrice: input.unitPrice,
		trackerUrl: input.trackerUrl,
		latestPriceDate: input.priceDate,
		lastSyncedAt: syncedAt,
	});

	createInvestmentHoldingSnapshot({
		holdingId: holding.id,
		currentValue: input.currentValue,
		unitPrice: input.unitPrice,
		units: input.units,
		capturedAt: syncedAt,
	});

	return {
		holdingId: holding.id,
		name: holding.name,
		currentValue: input.currentValue,
		unitPrice: input.unitPrice,
		priceDate: input.priceDate,
	};
}

async function refreshNordeaHolding(
	holding: InvestmentHolding,
): Promise<RefreshHoldingResult | null> {
	const normalizedTrackerUrl = nordeaUrlByHoldingName[holding.name] ?? holding.trackerUrl;
	if (!normalizedTrackerUrl) {
		return null;
	}

	const quote = await fetchNordeaQuote(normalizedTrackerUrl);
	const units = holding.units ?? Number((holding.currentValue / quote.unitPrice).toFixed(6));
	const currentValue = Number((quote.unitPrice * units).toFixed(2));

	return persistRefreshedHolding(holding, {
		currentValue,
		units,
		unitPrice: quote.unitPrice,
		priceDate: quote.priceDate,
		trackerUrl: normalizedTrackerUrl,
	});
}

function resolveAvanzaSlug(holding: InvestmentHolding): string | null {
	if (holding.trackerUrl) {
		const directSlugMatch = holding.trackerUrl.match(/avanza\.se\/([^/?#]+)/i);
		if (directSlugMatch?.[1]) {
			return directSlugMatch[1];
		}
	}

	return avanzaSlugByHoldingName[holding.name] ?? null;
}

async function searchAvanzaFund(query: string): Promise<AvanzaSearchHit | null> {
	const response = await fetch('https://www.avanza.se/_api/search/filtered-search', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			accept: 'application/json',
		},
		body: JSON.stringify({
			query,
			instrumentType: 'FUND',
			limit: 10,
		}),
	});

	if (!response.ok) {
		throw new Error(`Avanza search failed with ${response.status}`);
	}

	const payload = (await response.json()) as AvanzaSearchResponse;
	return (
		payload.hits.find((hit) => hit.title.toLowerCase() === query.toLowerCase()) ??
		payload.hits[0] ??
		null
	);
}

async function fetchAvanzaQuote(holding: InvestmentHolding): Promise<{
	priceDate: string;
	unitPrice: number;
	trackerUrl: string;
}> {
	const slug = resolveAvanzaSlug(holding);
	const searchHit = slug
		? await searchAvanzaFund(slug.replace(/-/g, ' '))
		: await searchAvanzaFund(holding.name);

	if (!searchHit) {
		throw new Error(`Could not resolve Avanza fund for ${holding.name}`);
	}

	const response = await fetch(
		`https://www.avanza.se/_api/fund-guide/guide/${searchHit.orderBookId}`,
		{
			headers: {
				accept: 'application/json',
			},
		},
	);

	if (!response.ok) {
		throw new Error(`Avanza guide request failed with ${response.status}`);
	}

	const payload = (await response.json()) as AvanzaGuideResponse;
	return {
		priceDate: payload.navDate.slice(0, 10),
		unitPrice: payload.nav,
		trackerUrl: `https://www.avanza.se/${searchHit.urlSlugName ?? slug ?? searchHit.orderBookId}`,
	};
}

async function refreshAvanzaHolding(
	holding: InvestmentHolding,
): Promise<RefreshHoldingResult | null> {
	const quote = await fetchAvanzaQuote(holding);
	const units = holding.units ?? Number((holding.currentValue / quote.unitPrice).toFixed(6));
	const currentValue = Number((quote.unitPrice * units).toFixed(2));

	return persistRefreshedHolding(holding, {
		currentValue,
		units,
		unitPrice: quote.unitPrice,
		priceDate: quote.priceDate,
		trackerUrl: quote.trackerUrl,
	});
}

async function refreshHolding(holding: InvestmentHolding): Promise<RefreshHoldingResult | null> {
	if (holding.currentValue <= 0) {
		return null;
	}

	if (holding.trackerSource === 'nordea') {
		return refreshNordeaHolding(holding);
	}

	if (holding.trackerSource === 'avanza') {
		return refreshAvanzaHolding(holding);
	}

	return null;
}

export async function refreshTrackedInvestmentHoldings(): Promise<RefreshHoldingResult[]> {
	const holdings = listInvestmentHoldings();
	const results: RefreshHoldingResult[] = [];

	for (const holding of holdings) {
		try {
			const result = await refreshHolding(holding);
			if (result) {
				results.push(result);
			}
		} catch (error) {
			console.error(`Failed to refresh holding ${holding.id}`, error);
		}
	}

	return results;
}
