import type { AnyCircuitElement } from "circuit-json"
import type { AnyExcellonDrillCommand } from "./any-excellon-drill-command-map"
import { excellonDrill } from "./excellon-drill-builder"

const getHoleOffsets = (element: AnyCircuitElement) => {
  if (element.type !== "pcb_plated_hole") {
    return { x: 0, y: 0 }
  }

  const offsetX =
    "hole_offset_x" in element && typeof element.hole_offset_x === "number"
      ? element.hole_offset_x
      : 0
  const offsetY =
    "hole_offset_y" in element && typeof element.hole_offset_y === "number"
      ? element.hole_offset_y
      : 0

  return { x: offsetX, y: offsetY }
}

const getPlatedHoleShape = (element: AnyCircuitElement): string | undefined => {
  if (element.type !== "pcb_plated_hole") return undefined
  if ("hole_shape" in element && typeof element.hole_shape === "string") {
    return element.hole_shape
  }
  return element.shape as string
}

const getHoleToolDiameter = (element: AnyCircuitElement) => {
  if (
    element.type === "pcb_plated_hole" ||
    element.type === "pcb_hole" ||
    element.type === "pcb_via"
  ) {
    if (
      "hole_diameter" in element &&
      typeof element.hole_diameter === "number"
    ) {
      return element.hole_diameter
    }
  }

  if (element.type === "pcb_plated_hole") {
    const holeShape = getPlatedHoleShape(element)
    if (
      holeShape?.includes("pill") &&
      "hole_width" in element &&
      typeof element.hole_width === "number" &&
      "hole_height" in element &&
      typeof element.hole_height === "number"
    ) {
      return Math.min(element.hole_width, element.hole_height)
    }
  }

  return undefined
}

const getSlotEndpoints = (
  element: AnyCircuitElement,
  center: { x: number; y: number },
) => {
  if (element.type !== "pcb_plated_hole") return undefined

  const holeShape = getPlatedHoleShape(element)
  if (!holeShape?.includes("pill")) {
    return undefined
  }

  if (
    !("hole_width" in element && typeof element.hole_width === "number") ||
    !("hole_height" in element && typeof element.hole_height === "number")
  ) {
    return undefined
  }

  const width = element.hole_width
  const height = element.hole_height
  const major = Math.max(width, height)
  const minor = Math.min(width, height)
  const halfSlot = (major - minor) / 2

  if (halfSlot <= 0) {
    return undefined
  }

  const rotationDegrees =
    holeShape.includes("rotated") &&
    "hole_ccw_rotation" in element &&
    typeof element.hole_ccw_rotation === "number"
      ? element.hole_ccw_rotation
      : 0
  const rotation = (rotationDegrees * Math.PI) / 180
  const baseAngle = width >= height ? 0 : Math.PI / 2
  const angle = baseAngle + rotation
  const axis = { x: Math.cos(angle), y: Math.sin(angle) }

  return {
    start: {
      x: center.x - axis.x * halfSlot,
      y: center.y - axis.y * halfSlot,
    },
    end: {
      x: center.x + axis.x * halfSlot,
      y: center.y + axis.y * halfSlot,
    },
  }
}

export const convertSoupToExcellonDrillCommands = ({
  circuitJson,
  is_plated,
  flip_y_axis = false,
}: {
  circuitJson: Array<AnyCircuitElement>
  is_plated: boolean
  flip_y_axis?: boolean
}): Array<AnyExcellonDrillCommand> => {
  const builder = excellonDrill()

  // Start sequence commands
  builder.add("M48", {})

  // Add header comments
  const date_str = new Date().toISOString()
  builder
    .add("header_comment", {
      text: `DRILL file {tscircuit} date ${date_str}`,
    })
    .add("header_comment", {
      text: "FORMAT={-:-/ absolute / metric / decimal}",
    })
    .add("header_attribute", {
      attribute_name: "TF.CreationDate",
      attribute_value: date_str,
    })
    .add("header_attribute", {
      attribute_name: "TF.GenerationSoftware",
      attribute_value: "tscircuit",
    })
    .add("header_attribute", {
      attribute_name: "TF.FileFunction",
      attribute_value: "Plated,1,2,PTH",
    })
    .add("FMAT", { format: 2 }) // Assuming format 2 for the example
    .add("unit_format", { unit: "METRIC", lz: null })

  let tool_counter = 10 // Start tool numbering from 10 for example

  const diameterToToolNumber: Record<number, number> = {}

  // Define tools
  for (const element of circuitJson) {
    if (
      element.type !== "pcb_plated_hole" &&
      element.type !== "pcb_hole" &&
      element.type !== "pcb_via"
    ) {
      continue
    }

    const hole_diameter = getHoleToolDiameter(element)
    if (!hole_diameter) continue

    if (!diameterToToolNumber[hole_diameter]) {
      builder.add("aper_function_header", {
        is_plated: true,
      })
      builder.add("define_tool", {
        tool_number: tool_counter,
        diameter: hole_diameter,
      })
      diameterToToolNumber[hole_diameter] = tool_counter
      tool_counter++
    }
  }

  builder.add("percent_sign", {})
  builder.add("G90", {})
  builder.add("G05", {})

  const y_multiplier = flip_y_axis ? -1 : 1

  // Execute drills for tool N
  for (let i = 10; i < tool_counter; i++) {
    builder.add("use_tool", { tool_number: i })
    for (const element of circuitJson) {
      if (
        element.type !== "pcb_plated_hole" &&
        element.type !== "pcb_hole" &&
        element.type !== "pcb_via"
      ) {
        continue
      }

      if (
        !is_plated &&
        (element.type === "pcb_plated_hole" || element.type === "pcb_via")
      ) {
        continue
      }

      const hole_diameter = getHoleToolDiameter(element)
      if (!hole_diameter) continue
      if (diameterToToolNumber[hole_diameter] !== i) continue

      if (element.type === "pcb_plated_hole") {
        const offsets = getHoleOffsets(element)
        const center = {
          x: element.x + offsets.x,
          y: element.y + offsets.y,
        }
        const slot = getSlotEndpoints(element, center)

        if (slot) {
          builder
            .add("G00", {})
            .add("drill_at", {
              x: slot.start.x,
              y: slot.start.y * y_multiplier,
            })
            .add("M15", {})
            .add("G01", {})
            .add("drill_at", {
              x: slot.end.x,
              y: slot.end.y * y_multiplier,
            })
            .add("M16", {})
            .add("G05", {})
        } else {
          builder.add("drill_at", {
            x: center.x,
            y: center.y * y_multiplier,
          })
        }
      } else {
        builder.add("drill_at", {
          x: element.x,
          y: element.y * y_multiplier,
        })
      }
    }
  }

  builder.add("M30", {})

  return builder.build()
}
