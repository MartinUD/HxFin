import type { BudgetCategory } from '$lib/schema/budget';

export interface HeuristicCategorizationMatch {
	categoryId: string;
	source: 'heuristic_keyword';
	matchedKeyword: string;
}

interface HeuristicDefinition {
	keywords: string[];
	categoryAliases: string[];
}

const HEURISTICS: HeuristicDefinition[] = [
	{
		keywords: ['foodora', 'wolt', 'uber eats'],
		categoryAliases: ['food', 'takeaway', 'take away', 'restaurant', 'restaurants', 'eating out'],
	},
	{
		keywords: ['ica', 'coop', 'willys', 'hemkop', 'lidl'],
		categoryAliases: ['groceries', 'grocery', 'mat', 'food store', 'livsmedel'],
	},
	{
		keywords: ['sl', 'sj', 'vy', 'vasttrafik'],
		categoryAliases: ['transport', 'travel', 'commute', 'trafik'],
	},
	{
		keywords: ['push gym', 'gym', 'friskis', 'sats', 'nordic wellness'],
		categoryAliases: [
			'subscriptions',
			'subscription',
			'prenumerationer',
			'prenumeration',
			'abonnemang',
			'membership',
			'gym membership',
		],
	},
];

function normalizeLabel(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.replace(/\s+/g, ' ');
}

function findCategoryIdByAliases(categories: BudgetCategory[], aliases: string[]): string | null {
	const aliasSet = new Set(aliases.map(normalizeLabel));
	const matches = categories.filter((category) => {
		const normalizedName = normalizeLabel(category.name);
		if (aliasSet.has(normalizedName)) {
			return true;
		}

		if (!category.description) {
			return false;
		}

		const descriptionTokens = normalizeLabel(category.description).split(' ');
		const descriptionPhrases = normalizeLabel(category.description)
			.split(',')
			.map((segment) => segment.trim())
			.filter(Boolean);

		return aliases.some((alias) => {
			const normalizedAlias = normalizeLabel(alias);
			return (
				descriptionPhrases.includes(normalizedAlias) ||
				descriptionTokens.join(' ').includes(normalizedAlias)
			);
		});
	});

	return matches.length === 1 ? matches[0].id : null;
}

export function findHeuristicCategoryMatch(input: {
	normalizedDescription: string;
	categories: BudgetCategory[];
}): HeuristicCategorizationMatch | null {
	for (const heuristic of HEURISTICS) {
		const matchedKeyword = heuristic.keywords.find((keyword) =>
			input.normalizedDescription.includes(keyword),
		);
		if (!matchedKeyword) {
			continue;
		}

		const categoryId = findCategoryIdByAliases(input.categories, heuristic.categoryAliases);
		if (!categoryId) {
			continue;
		}

		return {
			categoryId,
			source: 'heuristic_keyword',
			matchedKeyword,
		};
	}

	return null;
}
