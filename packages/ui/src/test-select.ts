import { fireEvent, screen } from "@testing-library/react";

const pointer = { button: 0, ctrlKey: false, pointerType: "mouse", pointerId: 1 };

export function openSelect(label: string | RegExp) {
	const trigger = screen.getByLabelText(label);
	fireEvent.pointerDown(trigger, pointer);
	return trigger;
}

export function chooseSelect(label: string | RegExp, optionName: string) {
	openSelect(label);
	const option = screen.getByRole("option", { name: optionName });
	option.focus();
	fireEvent.keyDown(option, { key: "Enter" });
}

export function selectOptionTexts(label: string | RegExp): string[] {
	openSelect(label);
	return screen.getAllByRole("option").map((option) => option.textContent ?? "");
}
