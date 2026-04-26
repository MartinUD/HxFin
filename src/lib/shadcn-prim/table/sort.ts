export type SortDirection = 'asc' | 'desc';

export interface SortState<Key extends string> {
	key: Key;
	direction: SortDirection;
}

function applyDirection(comparison: number, direction: SortDirection): number {
	return direction === 'asc' ? comparison : comparison * -1;
}

export function toggleSort<Key extends string>(
	current: SortState<Key>,
	key: Key,
): SortState<Key> {
	if (current.key === key) {
		return {
			key,
			direction: current.direction === 'asc' ? 'desc' : 'asc',
		};
	}

	return {
		key,
		direction: 'asc',
	};
}

export function sortAlphabetical(
	left: string,
	right: string,
	direction: SortDirection,
): number {
	return applyDirection(
		left.localeCompare(right, undefined, { sensitivity: 'base' }),
		direction,
	);
}

export function sortValue(
	left: number,
	right: number,
	direction: SortDirection,
): number {
	return applyDirection(left - right, direction);
}
