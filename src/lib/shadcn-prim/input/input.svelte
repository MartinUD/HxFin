<script lang="ts">
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/shared/cn.js";

	type InputType = Exclude<HTMLInputTypeAttribute, "file">;

	type Props = WithElementRef<
		Omit<HTMLInputAttributes, "type"> &
			({ type: "file"; files?: FileList } | { type?: InputType; files?: undefined })
	>;

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		files = $bindable(),
		class: className,
		"data-slot": dataSlot = "input",
		...restProps
	}: Props = $props();
</script>

{#if type === "file"}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			"[font-family:var(--ds-font-body)] selection:bg-[var(--app-accent)] selection:text-black border-[var(--app-border)] placeholder:text-[var(--app-text-muted)] text-[var(--app-text-primary)] flex h-9 w-full min-w-0 rounded-[var(--app-radius-sm)] border bg-[var(--app-bg-input)] px-3 pt-1.5 text-sm font-medium transition-[color,background-color,border-color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50",
			"focus-visible:border-[var(--app-accent)] focus-visible:ring-[3px] focus-visible:ring-[var(--app-accent-glow)]",
			"aria-invalid:ring-[var(--app-red-glow)] aria-invalid:border-[var(--app-red)]",
			className
		)}
		type="file"
		bind:files
		bind:value
		{...restProps}
	/>
{:else}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			"[font-family:var(--ds-font-body)] border-[var(--app-border)] bg-[var(--app-bg-input)] selection:bg-[var(--app-accent)] selection:text-black placeholder:text-[var(--app-text-muted)] text-[var(--app-text-primary)] flex h-9 w-full min-w-0 rounded-[var(--app-radius-sm)] border px-3 py-1 text-base transition-[color,background-color,border-color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
			"focus-visible:border-[var(--app-accent)] focus-visible:ring-[3px] focus-visible:ring-[var(--app-accent-glow)]",
			"aria-invalid:ring-[var(--app-red-glow)] aria-invalid:border-[var(--app-red)]",
			className
		)}
		{type}
		bind:value
		{...restProps}
	/>
{/if}
