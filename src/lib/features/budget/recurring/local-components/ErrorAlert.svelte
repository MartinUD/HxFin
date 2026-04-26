<script lang="ts">
	import * as Alert from '$lib/shadcn-prim/alert';

	interface Props {
		message: string | null;
		onDismiss: () => void;
	}

	let { message, onDismiss }: Props = $props();
</script>

{#if message}
	<Alert.Root class="border-destructive/50 bg-destructive/10">
		<Alert.Description class="flex items-center justify-between text-destructive">
			{message}
			<button
				type="button"
				onclick={onDismiss}
				class="ml-4 opacity-70 hover:opacity-100 text-sm leading-none"
			>
				✕
			</button>
		</Alert.Description>
	</Alert.Root>
{/if}
