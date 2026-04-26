import * as HttpApi from '@effect/platform/HttpApi';

import { budgetApiGroup } from '$lib/api/groups/budget';
import { financeApiGroup } from '$lib/api/groups/finance';
import { investmentsApiGroup } from '$lib/api/groups/investments';
import { loansApiGroup } from '$lib/api/groups/loans';
import { wishlistApiGroup } from '$lib/api/groups/wishlist';
import { AppErrorSchema } from '$lib/effect/errors';

export const FinApi = HttpApi.make('fin')
	.addError(AppErrorSchema)
	.add(financeApiGroup)
	.add(budgetApiGroup)
	.add(loansApiGroup)
	.add(wishlistApiGroup)
	.add(investmentsApiGroup)
	.prefix('/api');
