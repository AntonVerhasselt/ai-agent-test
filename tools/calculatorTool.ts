import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const calculatorTool = tool(
  async ({ operation, num1, num2 }: {
    operation: "add" | "subtract" | "multiply" | "divide";
    num1: number;
    num2: number;
  }) => {
    switch (operation) {
      case "add":
        return `${num1} + ${num2} = ${num1 + num2}`;
      case "subtract":
        return `${num1} - ${num2} = ${num1 - num2}`;
      case "multiply":
        return `${num1} × ${num2} = ${num1 * num2}`;
      case "divide":
        if (num2 === 0) {
          throw new Error("Cannot divide by zero");
        }
        return `${num1} ÷ ${num2} = ${num1 / num2}`;
      default:
        throw new Error("Invalid operation");
    }
  },
  {
    name: "calculator",
    description: "Useful for performing basic arithmetic calculations between two numbers",
    schema: z.object({
      operation: z.enum(["add", "subtract", "multiply", "divide"]),
      num1: z.number().describe("The first number"),
      num2: z.number().describe("The second number"),
    }),
  }
);