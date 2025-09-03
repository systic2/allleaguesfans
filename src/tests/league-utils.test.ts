// tests/league-utils.test.ts
import { describe, expect, it } from "vitest"

function latestSeason(years: number[]) {
  return years.filter(Number.isInteger).reduce((a, b) => Math.max(a, b), -Infinity)
}

describe("latestSeason", () => {
  it("choose max integer", () => {
    expect(latestSeason([2022, 2023, 2024])).toBe(2024)
  })
  it("ignore invalid", () => {
    // @ts-expect-error
    expect(latestSeason([2021, undefined, 2020])).toBe(2021)
  })
})
