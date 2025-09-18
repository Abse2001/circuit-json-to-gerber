import type { AnyCircuitElement } from "circuit-json"
import { expect, test } from "bun:test"
import { convertSoupToGerberCommands } from "src/gerber/convert-soup-to-gerber-commands"

test("plated hole with rect pad flashes pad at nominal position despite hole offset", () => {
  const soup: AnyCircuitElement[] = [
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "pad_offset",
      shape: "pill_hole_with_rect_pad",
      hole_shape: "pill",
      pad_shape: "rect",
      hole_width: 1.8,
      hole_height: 0.8,
      rect_pad_width: 2.6,
      rect_pad_height: 1.2,
      hole_offset_x: 0.4,
      hole_offset_y: -0.3,
      x: 4,
      y: 3,
      layers: ["top", "bottom"],
    } as unknown as AnyCircuitElement,
  ]

  const gerberLayers = convertSoupToGerberCommands(soup)
  const topCopper = gerberLayers.F_Cu
  const padFlash = topCopper.find((cmd) => cmd.command_code === "D03") as
    | { x: number; y: number }
    | undefined

  expect(padFlash).toBeDefined()
  expect(padFlash?.x).toBeCloseTo(4)
  expect(padFlash?.y).toBeCloseTo(3)
})
