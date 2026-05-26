import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TagBadge } from "./TagBadge.js";

describe("TagBadge", () => {
	it("renders tag name", () => {
		render(<TagBadge name="Engineering" color="#3b82f6" />);
		expect(screen.getByText("Engineering")).toBeTruthy();
	});

	it("applies preset color tokens as inline styles", () => {
		render(<TagBadge name="Bug" color="#ef4444" />);
		const badge = screen.getByText("Bug");
		expect(badge.style.backgroundColor).toBe("#fef2f2");
		expect(badge.style.color).toBe("#991b1b");
		expect(badge.style.borderColor).toBe("#fecaca");
	});

	it("applies fallback gray tokens for null color", () => {
		render(<TagBadge name="Draft" color={null} />);
		const badge = screen.getByText("Draft");
		expect(badge.style.backgroundColor).toBe("#f3f4f6");
		expect(badge.style.color).toBe("#374151");
		expect(badge.style.borderColor).toBe("#d1d5db");
	});

	it("renders sm size by default", () => {
		render(<TagBadge name="Test" color={null} />);
		const badge = screen.getByText("Test");
		expect(badge.className).toContain("text-xs");
	});

	it("renders md size when specified", () => {
		render(<TagBadge name="Test" color={null} size="md" />);
		const badge = screen.getByText("Test");
		expect(badge.className).toContain("text-sm");
	});

	it("merges custom className", () => {
		render(<TagBadge name="Test" color={null} className="ml-2" />);
		const badge = screen.getByText("Test");
		expect(badge.className).toContain("ml-2");
	});

	it("sets title attribute for truncated names", () => {
		render(<TagBadge name="Very Long Tag Name" color={null} />);
		const badge = screen.getByText("Very Long Tag Name");
		expect(badge.getAttribute("title")).toBe("Very Long Tag Name");
	});

	it("computes tokens for custom hex colors", () => {
		render(<TagBadge name="Custom" color="#ff00ff" />);
		const badge = screen.getByText("Custom");
		expect(badge.style.backgroundColor).toMatch(/^rgb\(/);
		expect(badge.style.color).toMatch(/^rgb\(/);
		expect(badge.style.borderColor).toMatch(/^rgb\(/);
	});
});
