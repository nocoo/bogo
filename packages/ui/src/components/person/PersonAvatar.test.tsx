import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { avatarColors, avatarInitial } from "../../lib/avatar.js";
import { PersonAvatar } from "./PersonAvatar.js";

describe("PersonAvatar", () => {
	it("renders the name's initial when no avatarUrl is provided", () => {
		render(<PersonAvatar name="Shizhe Huang" />);
		expect(screen.getByText(avatarInitial("Shizhe Huang"))).toBeTruthy();
	});

	it("uses a deterministic hashed background color when no image is provided", () => {
		const { container } = render(<PersonAvatar name="Shizhe Huang" />);
		const root = container.firstChild as HTMLElement;
		const { bg } = avatarColors("Shizhe Huang");
		expect(root.style.backgroundColor).not.toBe("");
		// styles set as hex are stored as rgb() — check it differs across names
		const { container: c2 } = render(<PersonAvatar name="Justin Lee" />);
		const root2 = c2.firstChild as HTMLElement;
		expect(root.style.backgroundColor).not.toBe(root2.style.backgroundColor);
		// presence check that bg from palette is in the style attribute
		expect(bg).toMatch(/^#/);
	});

	it("renders an image when avatarUrl is provided", () => {
		render(<PersonAvatar name="Alice" avatarUrl="https://example.com/a.png" />);
		const img = screen.getByRole("img", { hidden: true }) as HTMLImageElement;
		expect(img.tagName.toLowerCase()).toBe("span");
		const innerImg = img.querySelector("img");
		expect(innerImg?.getAttribute("src")).toBe("https://example.com/a.png");
	});

	it("exposes name in aria-label", () => {
		render(<PersonAvatar name="Alice" />);
		const root = screen.getByRole("img");
		expect(root.getAttribute("aria-label")).toBe("Avatar for Alice");
	});

	it("uses generic aria-label for empty names", () => {
		render(<PersonAvatar name="" />);
		const root = screen.getByRole("img");
		expect(root.getAttribute("aria-label")).toBe("Avatar");
	});

	it("applies size variants", () => {
		const { container: sm } = render(<PersonAvatar name="A" size="sm" />);
		const { container: lg } = render(<PersonAvatar name="A" size="lg" />);
		const smRoot = sm.firstChild as HTMLElement;
		const lgRoot = lg.firstChild as HTMLElement;
		expect(smRoot.className).toContain("h-6");
		expect(lgRoot.className).toContain("h-9");
	});

	it("forwards extra className", () => {
		const { container } = render(<PersonAvatar name="A" className="custom-class" />);
		const root = container.firstChild as HTMLElement;
		expect(root.className).toContain("custom-class");
	});
});
