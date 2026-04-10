export interface DeterministicCategorizationMatch {
	categoryId: string;
	source: 'rule_exact' | 'history_exact';
}

export function resolveDeterministicCategorization(input: {
	ruleCategoryId?: string | null;
	historyCategoryId?: string | null;
}): DeterministicCategorizationMatch | null {
	if (input.ruleCategoryId) {
		return {
			categoryId: input.ruleCategoryId,
			source: 'rule_exact',
		};
	}

	if (input.historyCategoryId) {
		return {
			categoryId: input.historyCategoryId,
			source: 'history_exact',
		};
	}

	return null;
}
