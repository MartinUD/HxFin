export type PrimaryNavigationChild = {
	href: string;
	label: string;
	state?: 'ready' | 'planned';
};

export type PrimaryNavigationSection = {
	key: 'budget' | 'investments' | 'imports' | 'loans';
	href: string;
	label: string;
	children: PrimaryNavigationChild[];
};

export const primaryNavigation: PrimaryNavigationSection[] = [
	{
		key: 'budget',
		href: '/budget',
		label: 'Budget',
		children: [
			{ href: '/budget/recurring', label: 'Recurring' },
			{ href: '/budget/planned-purchases', label: 'Planned Purchases' },
			{ href: '/budget/income', label: 'Income' },
		],
	},
	{
		key: 'investments',
		href: '/investments',
		label: 'Investments',
		children: [
			{ href: '/investments/portfolio', label: 'Portfolio' },
			{ href: '/investments/projections', label: 'Projections' },
		],
	},
	{
		key: 'imports',
		href: '/imports',
		label: 'Imports',
		children: [
			{ href: '/imports/inbox', label: 'Inbox' },
			{ href: '/imports/all-transactions', label: 'All Transactions', state: 'planned' },
			{ href: '/imports/rules', label: 'Rules', state: 'planned' },
		],
	},
	{
		key: 'loans',
		href: '/loans',
		label: 'Loans',
		children: [],
	},
];
