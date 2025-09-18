import type { AnyCircuitElement } from "circuit-json"
import { test, expect } from "bun:test"
import {
  convertSoupToExcellonDrillCommands,
  stringifyExcellonDrill,
} from "src/excellon-drill"

test("generate excellon drill text from axial resistor", async () => {
  const soup: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "simple_resistor_0",
      name: "R1",
      supplier_part_numbers: {},
      ftype: "simple_resistor",
      resistance: 10000,
    },
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "pcb_plated_hole_0",
      x: -10,
      y: 10,
      layers: ["top", "bottom"],
      hole_diameter: 2.5,
      shape: "circle",
      outer_diameter: 3.2,
      port_hints: ["1"],
      pcb_component_id: "pcb_generic_component_0",
    },
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "pcb_plated_hole_1",
      x: 0.3103934649070921,
      y: -10.745920624907164,
      layers: ["top", "bottom"],
      hole_diameter: 1,
      shape: "circle",
      outer_diameter: 1.2,
      port_hints: ["1"],
      pcb_component_id: "pcb_component_simple_bug_1",
      pcb_port_id: "pcb_port_25",
    },
    {
      type: "pcb_via",
      pcb_via_id: "pcb_via_0",
      x: -4.281249780862737,
      y: -14.233181814231745,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      layers: ["top", "bottom"],
      from_layer: "top",
      to_layer: "bottom",
    },
  ]

  const excellon_drill_cmds = convertSoupToExcellonDrillCommands({
    circuitJson: soup,
    is_plated: true,
  })

  const excellon_drill_file_content =
    stringifyExcellonDrill(excellon_drill_cmds)

  expect(excellon_drill_file_content.includes("X-10.0000Y10.0000")).toBeTrue()
  expect(excellon_drill_file_content.includes("T10C2.500000")).toBeTrue()
  expect(excellon_drill_file_content.includes("G90")).toBeTrue()
  expect(excellon_drill_file_content.includes("G05")).toBeTrue()
})

test("circular plated hole with rect pad applies drill offset", () => {
  const soup: AnyCircuitElement[] = [
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "offset_circle",
      shape: "circular_hole_with_rect_pad",
      hole_shape: "circle",
      pad_shape: "rect",
      hole_diameter: 0.8,
      rect_pad_width: 1.2,
      rect_pad_height: 1.5,
      hole_offset_x: 0.5,
      hole_offset_y: -0.25,
      x: 10,
      y: 10,
      layers: ["top", "bottom"],
    } as unknown as AnyCircuitElement,
  ]

  const output = stringifyExcellonDrill(
    convertSoupToExcellonDrillCommands({
      circuitJson: soup,
      is_plated: true,
    }),
  )

  expect(output).toContain("X10.5000Y9.7500")
})

test("pill plated hole with rect pad applies slot offset", () => {
  const soup: AnyCircuitElement[] = [
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "offset_slot",
      shape: "pill_hole_with_rect_pad",
      hole_shape: "pill",
      pad_shape: "rect",
      hole_width: 2.4,
      hole_height: 0.6,
      rect_pad_width: 3,
      rect_pad_height: 1.2,
      hole_offset_x: -0.3,
      hole_offset_y: 0.2,
      x: 1,
      y: 2,
      layers: ["top", "bottom"],
    } as unknown as AnyCircuitElement,
  ]

  const output = stringifyExcellonDrill(
    convertSoupToExcellonDrillCommands({
      circuitJson: soup,
      is_plated: true,
    }),
  )

  expect(output).toContain("X-0.2000Y2.2000")
  expect(output).toContain("X1.6000Y2.2000")
})

test("rotated pill plated hole with rect pad applies slot offset", () => {
  const soup: AnyCircuitElement[] = [
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "offset_rotated_slot",
      shape: "rotated_pill_hole_with_rect_pad",
      hole_shape: "rotated_pill",
      pad_shape: "rect",
      hole_width: 1.4,
      hole_height: 0.6,
      hole_ccw_rotation: 90,
      rect_pad_width: 2,
      rect_pad_height: 1.2,
      rect_ccw_rotation: 0,
      hole_offset_x: 0.1,
      hole_offset_y: 0.2,
      x: 5,
      y: 5,
      layers: ["top", "bottom"],
    } as unknown as AnyCircuitElement,
  ]

  const output = stringifyExcellonDrill(
    convertSoupToExcellonDrillCommands({
      circuitJson: soup,
      is_plated: true,
    }),
  )

  expect(output).toContain("X5.1000Y4.8000")
  expect(output).toContain("X5.1000Y5.6000")
})
