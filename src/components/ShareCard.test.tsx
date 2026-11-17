import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ShareCard } from "./ShareCard";

const mocks = vi.hoisted(() => ({
  evaluated: vi.fn(), render: vi.fn(), success: vi.fn(), error: vi.fn(),
}));
vi.mock("html2canvas", () => { mocks.evaluated(); return { default: mocks.render }; });
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

let downloads: Array<{ filename: string; href: string }>;
const dataUrl = "data:image/png;base64,fixture";
beforeEach(() => {
  vi.clearAllMocks(); downloads = [];
  mocks.render.mockResolvedValue({
    toDataURL: vi.fn(() => dataUrl),
    toBlob: (callback: BlobCallback) => callback(new Blob(["fixture"], { type: "image/png" })),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
    downloads.push({ filename: this.download, href: this.href });
  });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "share");
});
const openCard = () => render(<ShareCard open onOpenChange={() => {}} name="Fixture Name" arabic="اسم" meaning="Fixture" />);

describe("card renderer intent boundary", () => {
  it("opening and editing the preview does not load the renderer; Download preserves its contract", async () => {
    openCard();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Preview only" } });
    expect(mocks.evaluated).not.toHaveBeenCalled();
    expect(mocks.render).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^Download$/ }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Image downloaded"));
    expect(mocks.evaluated).toHaveBeenCalledTimes(1);
    expect(mocks.render).toHaveBeenCalledWith(expect.any(HTMLElement), {
      scale: 1080 / 380, useCORS: true, backgroundColor: "#0f766e", logging: false,
    });
    expect(downloads).toEqual([{ filename: "muslimname-fixture-name.png", href: dataUrl }]);
  });
  it("native Share still receives a PNG File and the existing message", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    openCard();
    expect(mocks.render).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^Share$/ }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const payload = share.mock.calls[0][0];
    expect(payload.title).toBe("Fixture Name — Islamic Name");
    expect(payload.text).toBe("Fixture Name — Fixture");
    expect(payload.files[0]).toBeInstanceOf(File);
    expect(payload.files[0].type).toBe("image/png");
    expect(payload.files[0].name).toBe("muslimname-Fixture Name.png");
  });
  it("Share without device support retains the download fallback", async () => {
    openCard();
    fireEvent.click(screen.getByRole("button", { name: /^Share$/ }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(mocks.render).toHaveBeenCalledTimes(1);
  });
  it("render failure keeps the error feedback and allows another download attempt", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.render.mockRejectedValueOnce(new Error("fixture renderer failure"));
    openCard();
    fireEvent.click(screen.getByRole("button", { name: /^Download$/ }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Failed to create image"));
    expect(downloads).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /^Download$/ }));
    await waitFor(() => expect(downloads).toHaveLength(1));
  });
});
