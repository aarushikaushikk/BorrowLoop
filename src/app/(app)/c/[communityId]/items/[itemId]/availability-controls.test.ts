import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AddBlockedRangeState, RemoveBlockedRangeState } from "@/app/(app)/c/[communityId]/items/[itemId]/actions";
import { BlockedDatesForm } from "@/app/(app)/c/[communityId]/items/[itemId]/blocked-dates-form";
import { RemoveBlockButton } from "@/app/(app)/c/[communityId]/items/[itemId]/remove-block-button";
import { BLOCKED_RANGE_MESSAGES, NOTE_MAX } from "@/lib/validation/availability";

// Static-markup tests of the lender controls. useActionState is replaced so
// each state (idle, pending, error, success) can be rendered and inspected.
// They prove what markup each state produces and which action each form is
// wired to; they do NOT prove browser behaviour (submitting, pending
// transitions, focus). That needs a manual browser check: no E2E tooling.

const { useActionStateMock, addActionMock, removeActionMock, formActionMock } = vi.hoisted(() => ({
  useActionStateMock: vi.fn(),
  addActionMock: vi.fn(),
  removeActionMock: vi.fn(),
  formActionMock: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: useActionStateMock,
}));
vi.mock("@/app/(app)/c/[communityId]/items/[itemId]/actions", () => ({
  addBlockedRangeAction: addActionMock,
  removeBlockedRangeAction: removeActionMock,
}));

const COMMUNITY_ID = "clx0community0001";
const ITEM_ID = "clx0item000000001";
const TODAY = "2026-11-27";

function withState(state: AddBlockedRangeState | RemoveBlockedRangeState, pending = false) {
  useActionStateMock.mockReturnValue([state, formActionMock, pending]);
}

beforeEach(() => {
  useActionStateMock.mockReset();
  withState({ status: "idle" });
});

/** Attributes of every `<tag …>` in the markup, in document order. */
function tags(html: string, tag: string): Record<string, string>[] {
  return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, "g"))].map((match) =>
    Object.fromEntries([...match[1]!.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map((a) => [a[1]!, a[2] ?? ""])),
  );
}

/** Visible text: tags removed and HTML entities React emits decoded. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** The text content of the element with this id. */
function textById(html: string, id: string): string {
  const match = new RegExp(`<(\\w+)[^>]*\\bid="${id}"[^>]*>(.*?)</\\1>`).exec(html);
  return match ? text(match[2]!) : "";
}

/** The input named `name`, plus the text of its <label for=…>. */
function field(html: string, name: string) {
  const input = tags(html, "input").find((candidate) => candidate.name === name);
  expect(input, `input named ${name}`).toBeDefined();
  const labelMatch = input?.id ? new RegExp(`<label[^>]*for="${input.id}"[^>]*>(.*?)</label>`).exec(html) : null;
  return { input: input ?? {}, label: labelMatch ? text(labelMatch[1]!) : "" };
}

/** The text of each element listed in an aria-describedby value. */
function describedBy(html: string, input: Record<string, string>): string[] {
  return (input["aria-describedby"] ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => textById(html, id));
}

function renderForm(): string {
  return renderToStaticMarkup(createElement(BlockedDatesForm, { communityId: COMMUNITY_ID, itemId: ITEM_ID, today: TODAY }));
}

function renderRemove(): string {
  return renderToStaticMarkup(
    createElement(RemoveBlockButton, {
      communityId: COMMUNITY_ID,
      availabilityId: "block-a",
      rangeLabel: "Dec 1 – Dec 5, 2026",
    }),
  );
}

describe("BlockedDatesForm", () => {
  it("is wired to addBlockedRangeAction with an idle initial state", () => {
    renderForm();

    expect(useActionStateMock).toHaveBeenCalledWith(addActionMock, { status: "idle" });
  });

  it("submits only the community and item IDs as hidden fields, plus the three range fields", () => {
    const html = renderForm();

    const inputs = tags(html, "input");
    expect(inputs.filter((input) => input.type === "hidden")).toEqual([
      expect.objectContaining({ name: "communityId", value: COMMUNITY_ID }),
      expect.objectContaining({ name: "itemId", value: ITEM_ID }),
    ]);
    expect(inputs.map((input) => input.name).sort()).toEqual(["communityId", "endDate", "itemId", "note", "startDate"]);
  });

  it("labels required start and end date inputs, with today as the minimum", () => {
    const html = renderForm();

    for (const [name, labelText] of [
      ["startDate", "Start date"],
      ["endDate", "End date"],
    ] as const) {
      const { input, label } = field(html, name);
      expect(input).toMatchObject({ type: "date", required: "", min: TODAY });
      expect(input.id).toBeTruthy();
      expect(label).toContain(labelText);
    }
  });

  it("marks required fields visibly and explains the marker", () => {
    const html = renderForm();

    // The asterisk is decorative (aria-hidden); `required` carries the meaning for assistive tech.
    expect(html).toMatch(/<span[^>]*aria-hidden="true"[^>]*>\*<\/span>/);
    expect(text(html)).toMatch(/\* Required/);
  });

  it("labels the note as optional and private, with its length limit", () => {
    const html = renderForm();

    const { input, label } = field(html, "note");
    expect(input.required).toBeUndefined();
    expect(input.maxlength ?? input.maxLength).toBe(String(NOTE_MAX));
    expect(label).toMatch(/Private note \(optional\)/);
    expect(describedBy(html, input).join(" ")).toMatch(/Only you can see this note/);
  });

  it("has an enabled Block dates submit button and no messages while idle", () => {
    const html = renderForm();

    expect(tags(html, "button")).toEqual([expect.objectContaining({ type: "submit" })]);
    expect(tags(html, "button")[0]).not.toHaveProperty("disabled");
    expect(text(html)).toContain("Block dates");
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="status"');
  });

  it("disables the button and shows progress while pending", () => {
    withState({ status: "idle" }, true);

    const html = renderForm();

    expect(tags(html, "button")[0]).toHaveProperty("disabled");
    expect(text(html)).toContain("Blocking…");
  });

  it("shows field errors next to their inputs and links them with aria-describedby", () => {
    withState({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { startDate: BLOCKED_RANGE_MESSAGES.startDatePast, note: BLOCKED_RANGE_MESSAGES.noteTooLong },
    });

    const html = renderForm();

    expect(html).toMatch(/role="alert"/);
    expect(text(html)).toContain("Please fix the highlighted fields.");

    const start = field(html, "startDate").input;
    expect(start["aria-invalid"]).toBe("true");
    expect(describedBy(html, start)).toContain(BLOCKED_RANGE_MESSAGES.startDatePast);

    const note = field(html, "note").input;
    expect(note["aria-invalid"]).toBe("true");
    expect(describedBy(html, note)).toEqual(
      expect.arrayContaining([BLOCKED_RANGE_MESSAGES.noteTooLong, expect.stringMatching(/Only you can see this note/)]),
    );

    const end = field(html, "endDate").input;
    expect(end["aria-invalid"]).toBeUndefined();
  });

  it("shows a generic failure as an alert without marking any field invalid", () => {
    withState({ status: "error", message: "We couldn't block those dates. Refresh the page and try again." });

    const html = renderForm();

    expect(html).toMatch(/role="alert"/);
    expect(text(html)).toContain("We couldn't block those dates. Refresh the page and try again.");
    expect(html).not.toContain('aria-invalid="true"');
  });

  it("confirms success in a status message", () => {
    withState({ status: "added" });

    const html = renderForm();

    expect(html).toMatch(/role="status"/);
    expect(text(html)).toContain("Dates blocked.");
  });
});

describe("RemoveBlockButton", () => {
  it("is wired to removeBlockedRangeAction with an idle initial state", () => {
    renderRemove();

    expect(useActionStateMock).toHaveBeenCalledWith(removeActionMock, { status: "idle" });
  });

  it("submits only the community ID and block ID", () => {
    const html = renderRemove();

    expect(tags(html, "input")).toEqual([
      expect.objectContaining({ type: "hidden", name: "communityId", value: COMMUNITY_ID }),
      expect.objectContaining({ type: "hidden", name: "availabilityId", value: "block-a" }),
    ]);
  });

  it("names the range in the button's accessible text", () => {
    const html = renderRemove();

    const button = /<button\b[^>]*>(.*?)<\/button>/.exec(html);
    expect(button).not.toBeNull();
    expect(text(button![1]!)).toBe("Remove blocked dates Dec 1 – Dec 5, 2026");
    expect(tags(html, "button")[0]).toMatchObject({ type: "submit" });
    expect(tags(html, "button")[0]).not.toHaveProperty("disabled");
  });

  it("disables the button and shows progress while pending", () => {
    withState({ status: "idle" }, true);

    const html = renderRemove();

    expect(tags(html, "button")[0]).toHaveProperty("disabled");
    expect(text(html)).toContain("Removing…");
  });

  it("shows a generic failure as an alert", () => {
    withState({ status: "error", message: "We couldn't remove those dates. Refresh the page and try again." });

    const html = renderRemove();

    expect(html).toMatch(/role="alert"/);
    expect(text(html)).toContain("We couldn't remove those dates. Refresh the page and try again.");
  });
});
