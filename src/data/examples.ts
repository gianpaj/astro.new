import toTitle from "title"
const previewImageSlugs = new Set(
	Object.keys(import.meta.glob("../../public/previews/*.webp")).map((key) =>
		key
			.split("/")
			.pop()
			?.replace(/\.webp$/, ""),
	),
)

const TITLES = new Map([
	["with-tailwindcss", "Tailwind CSS"],
	["blog-multiple-authors", "Blog (Complex)"],
	["with-markdown-plugins", "Markdown (Remark Plugins)"],
	["framework-multiple", "Kitchen Sink (Multiple Frameworks)"],
	["basics", "Just the Basics"],
	["starlight-basics", "Starlight"],
	["minimal", "Empty Project"],
])
export const TOP_SECTION = "Getting Started"
const TOP_SECTION_ORDER = [
	"basics",
	"blog",
	"starlight-basics",
	"portfolio",
	"minimal",
]

const FEATURED_INTEGRATIONS = new Set(["tailwindcss"])
const FRAMEWORK_ORDER = [
	"react",
	"preact",
	"vue",
	"svelte",
	"lit",
	"solid",
].map((name) => `framework-${name}`)

type ExampleData = {
	name: string
	size: number
	url: string
	html_url: string
	git_url: string
	preview_image: string
}
export type Example = {
	name: string
	title: string
	sourceUrl: string
	stackblitzUrl: string
	codesandboxUrl: string
	gitpodUrl: string
	previewImage: string | undefined
}

function toExample({ name }: ExampleData, ref: string): Example {
	const suffix = ref === "main" ? "@next" : ""
	let title: string
	if (TITLES.has(name)) {
		title = TITLES.get(name) as string // we just checked w/ `.has()` it should exist.
	} else {
		title = toTitle(
			name.replace(/^(with|framework)/, "").replace(/-/g, " "),
		).trim()
	}
	return {
		name,
		sourceUrl: `/${name}${suffix}?on=github`,
		stackblitzUrl: `/${name}${suffix}?on=stackblitz`,
		codesandboxUrl: `/${name}${suffix}?on=codesandbox`,
		gitpodUrl: `/${name}${suffix}?on=gitpod`,
		previewImage: previewImageSlugs.has(name)
			? `/previews/${name}.webp`
			: undefined,
		title,
	}
}

export type ExampleGroup = {
	title: string
	slug: string
	items: Example[]
}

function groupExamplesByCategory(examples: ExampleData[], ref: string) {
	const gettingStartedItems: Example[] = []
	const frameworks: Example[] = []
	const integrations: Example[] = []
	const templates: Example[] = []

	for (const example of examples) {
		if (example.size !== 0) continue

		const data = toExample(example, ref)
		if (TOP_SECTION_ORDER.includes(example.name)) {
			gettingStartedItems.push(data)
		} else if (example.name.startsWith("with-")) {
			if (FEATURED_INTEGRATIONS.has(example.name.replace("with-", ""))) {
				integrations.splice(0, 0, data)
			} else {
				integrations.push(data)
			}
		} else if (example.name.startsWith("framework-")) {
			frameworks.push(data)
		} else {
			templates.push(data)
		}
	}

	return new Map(
		Object.entries({
			"getting-started": {
				title: TOP_SECTION,
				slug: "getting-started",
				items: gettingStartedItems.sort(sortExamplesByOrder(TOP_SECTION_ORDER)),
			},
			frameworks: {
				title: "Frameworks",
				slug: "frameworks",
				items: frameworks.sort(sortExamplesByOrder(FRAMEWORK_ORDER)),
			},
			integrations: {
				title: "Integrations",
				slug: "integrations",
				items: integrations,
			},
			templates: {
				title: "Templates",
				slug: "templates",
				items: templates,
			},
		}),
	)
}

function githubRequest(url: string) {
	const headers: Headers = new Headers({
		Accept: "application/vnd.github.v3+json",
	})
	if (typeof import.meta.env.PUBLIC_VITE_GITHUB_TOKEN !== "string") {
		console.warn(
			`PUBLIC_VITE_GITHUB_TOKEN is ${typeof import.meta.env
				.PUBLIC_VITE_GITHUB_TOKEN}. You may run into rate-limiting issues.`,
		)
	} else {
		headers.set(
			"Authorization",
			`token ${import.meta.env.PUBLIC_VITE_GITHUB_TOKEN}`,
		)
	}

	return new Request(url, { headers })
}

export async function getExamples(ref = "latest") {
	const examples = (
		await Promise.all([
			fetch(
				githubRequest(
					`https://api.github.com/repos/withastro/astro/contents/examples?ref=${ref}`,
				),
			).then((res) => res.json()),
			fetch(
				githubRequest(
					`https://api.github.com/repos/withastro/starlight/contents/examples`,
				),
			)
				.then((res) => res.json())
				// prefix starlight examples with "starlight-" to differentiate duplicate example names
				.then((examples: ExampleData[]) =>
					examples.map((example) => ({
						...example,
						name: `starlight-${example.name}`,
					})),
				),
		])
	).flat()

	if (!Array.isArray(examples)) {
		console.error(
			`GITHUB_TOKEN appears to be misconfigured. Expected array, got:`,
			examples,
		)
		throw new Error(`GITHUB_TOKEN appears to be misconfigured`)
	}
	return groupExamplesByCategory(examples as ExampleData[], ref)
}

function sortExamplesByOrder(order: string[]) {
	return (a: Example, b: Example) => {
		let aIndex = order.indexOf(a.name)
		let bIndex = order.indexOf(b.name)
		if (aIndex === -1) {
			aIndex = Infinity
		}
		if (bIndex === -1) {
			bIndex = Infinity
		}
		if (aIndex > bIndex) return 1
		if (aIndex < bIndex) return -1
		return 0
	}
}
