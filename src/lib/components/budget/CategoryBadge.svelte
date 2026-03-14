<script lang="ts">
	interface Props {
		name: string;
		color: string | null;
	}

	let { name, color }: Props = $props();

	let bg = $derived(color ? color + '22' : 'var(--app-bg-input)');
	let border = $derived(color ? color + '40' : 'var(--app-border)');
	let textColor = $derived(color ?? 'var(--app-text-secondary)');
</script>

<span class="badge" style="background: {bg}; border-color: {border}; color: {textColor}">
	{name}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		padding: 0.34rem 0.95rem;
		border-radius: 99px;
		border: 1px solid;
		font-size: 0.84rem;
		font-weight: 600;
		white-space: nowrap;
		flex-shrink: 0;
	}
</style>
