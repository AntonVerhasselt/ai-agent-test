import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StateGraph } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { MongoClient } from "mongodb";
import "dotenv/config";
import { calculatorTool } from "./tools/calculatorTool";
import { weatherTool } from "./tools/weatherTool";
import { traceable } from "langsmith/traceable";

export const callAgent = traceable(async function(client: MongoClient, query: string, thread_id: string) {
    // Define the MongoDB database and collection
    const dbName = "agent-test-db";
    const db = client.db(dbName);
    const collection = db.collection("tbd"); // TODO: determine collection name

    const GraphState = Annotation.Root({
        messages: Annotation<BaseMessage[]>({
            reducer: (x, y) => x.concat(y),
        }),
    });

    const tools = [calculatorTool, weatherTool];

    // We can extract the state typing via `GraphState.State`
    const toolNode = new ToolNode<typeof GraphState.State>(tools);

    const model = new ChatOpenAI({
        model: "gpt-4o-mini",
        temperature: 0,
    }).bind({ tools: tools });

    async function callModel(state: typeof GraphState.State) {
        const prompt = ChatPromptTemplate.fromMessages([
            [
                "system",
                `You are a helpful AI assistant specializing in weather information and mathematical calculations. You can help users get current weather data for any location and perform basic arithmetic operations (addition, subtraction, multiplication, and division). Use your tools to provide accurate weather forecasts and solve mathematical problems. If you have a complete answer to the user's query, prefix your response with FINAL ANSWER. You have access to the following tools: {tool_names}.\n{system_message}\nCurrent time: {time}.`,
            ],
            new MessagesPlaceholder("messages"),
        ]);

        const formattedPrompt = await prompt.formatMessages({
            system_message: "You are a helpful assistant that can provide weather information and perform calculations. You can help users get current weather data for any location and perform basic arithmetic operations like addition, subtraction, multiplication, and division.",
            time: new Date().toISOString(),
            tool_names: tools.map((tool) => tool.name).join(", "),
            messages: state.messages,
        });

        const result = await model.invoke(formattedPrompt);

        return { messages: [result] };
    }

    function shouldContinue(state: typeof GraphState.State) {
        const messages = state.messages;
        const lastMessage = messages[messages.length - 1] as AIMessage;

        // If the LLM makes a tool call, then we route to the "tools" node
        if (lastMessage.tool_calls?.length) {
            return "tools";
        }
        // Otherwise, we stop (reply to the user)
        return "__end__";
    }

    const workflow = new StateGraph(GraphState)
        .addNode("agent", callModel)
        .addNode("tools", toolNode)
        .addEdge("__start__", "agent")
        .addConditionalEdges("agent", shouldContinue)
        .addEdge("tools", "agent");

    const checkpointer = new MongoDBSaver({ client, dbName });

    const app = workflow.compile({ checkpointer });

    const finalState = await app.invoke(
        {
            messages: [new HumanMessage(query)],
        },
        { recursionLimit: 15, configurable: { thread_id: thread_id } }
    );

    console.log(finalState.messages[finalState.messages.length - 1].content);

    return finalState.messages[finalState.messages.length - 1].content;
});