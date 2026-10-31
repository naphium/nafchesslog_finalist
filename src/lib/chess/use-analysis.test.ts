import { act, renderHook } from "@testing-library/react";
import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { useAnalysis } from "./use-analysis";

const options = { apiDepth: 16, localDepth: 14 };
describe("interactive position analysis", () => {
  it("plays legal moves without changing the starting position", () => {
    const fen = new Chess().fen();
    const { result } = renderHook(() => useAnalysis(fen, false, options, false));
    act(() => { expect(result.current.move("e2", "e4")).toBe(true); });
    expect(result.current.line[0]?.san).toBe("e4");
    expect(new Chess(result.current.fen).get("e4")?.type).toBe("p");
    act(() => { expect(result.current.move("e4", "e5")).toBe(false); });
    expect(result.current.cursor).toBe(1);
    act(() => result.current.jump(0));
    expect(result.current.fen).toBe(fen);
    act(() => result.current.jump(1));
    expect(new Chess(result.current.fen).get("e4")?.type).toBe("p");
  });
  it("replaces only the analysis continuation after undo", () => {
    const { result } = renderHook(() => useAnalysis(new Chess().fen(), false, options, false));
    act(() => { result.current.move("e2", "e4"); });
    act(() => { result.current.move("e7", "e5"); });
    act(() => { result.current.jump(1); });
    act(() => { result.current.move("c7", "c5"); });
    expect(result.current.line.map((move) => move.san)).toEqual(["e4", "c5"]);
  });
  it("supports underpromotion", () => {
    const { result } = renderHook(() => useAnalysis("7k/P7/8/8/8/8/8/7K w - - 0 1", false, options, false));
    act(() => { result.current.move("a7", "a8", "n"); });
    expect(new Chess(result.current.fen).get("a8")?.type).toBe("n");
  });
});