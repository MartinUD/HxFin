import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseNordeaTransactionsCsv } from '../src/lib/server/imports/csv.ts';
import { normalizeMerchantDescription } from '../src/lib/server/imports/normalization.ts';

describe('imports csv parsing', () => {
	it('parses Nordea semicolon csv rows and normalizes core values', () => {
		const csv = [
			'\uFEFFBokfÃ¶ringsdag;Belopp;AvsÃ¤ndare;Mottagare;Namn;Rubrik;Saldo;Valuta;',
			'2026/02/20;-478,40;0000 00 00001;;;KortkÃ¶p 260219 Testbutik AB;100688,69;SEK;',
			'2026/02/19;478,00;;0000 00 00001;;Swish inbetalning EXEMPEL,ALVA;101219,66;SEK;',
		].join('\n');

		const rows = parseNordeaTransactionsCsv(csv);
		assert.equal(rows.length, 2);

		assert.deepEqual(rows[0], {
			bookingDate: '2026-02-20',
			amount: -478.4,
			description: 'KortkÃ¶p 260219 Testbutik AB',
			currency: 'SEK',
			sender: '0000 00 00001',
			receiver: null,
			balance: 100688.69,
		});

		assert.equal(rows[1].bookingDate, '2026-02-19');
		assert.equal(rows[1].amount, 478);
		assert.equal(rows[1].sender, null);
		assert.equal(rows[1].receiver, '0000 00 00001');
	});
});

describe('imports description normalization', () => {
	it('normalizes known payment prefixes into reusable merchant keys', () => {
		assert.equal(normalizeMerchantDescription('KortkÃ¶p 260219 Testbutik AB'), 'foodora ab');
		assert.equal(
			normalizeMerchantDescription('Swish betalning EXEMPEL FORENING'),
			'bofors verkstadsklu',
		);
		assert.equal(
			normalizeMerchantDescription('Betalning BG 000-0000 HYRESFORENING TEST'),
			'hsb karlskoga',
		);
	});
});
