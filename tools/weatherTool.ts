import { z } from "zod";
import { tool } from "@langchain/core/tools";

interface GeocodingResult {
  latitude: number;
  longitude: number;
  timezone: string;
}

export const weatherTool = tool(
  async ({ location }) => {
    try {
      // Step 1: Convert location to coordinates using Geocoding API
      const geocodingResponse = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          location
        )}&count=1&language=en&format=json`
      );
      
      const geocodingData = await geocodingResponse.json();
      
      if (!geocodingData.results?.[0]) {
        throw new Error(`Location '${location}' not found`);
      }

      const { latitude, longitude, timezone } = geocodingData.results[0];

      // Step 2: Fetch weather data using coordinates
      const weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?` +
        `latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,wind_direction_10m` +
        `&timezone=${timezone}`
      );

      const weatherData = await weatherResponse.json();

      // Step 3: Format and return the weather information
      return {
        location: location,
        current: {
          temperature: {
            value: weatherData.current.temperature_2m,
            unit: weatherData.current_units.temperature_2m
          },
          humidity: {
            value: weatherData.current.relative_humidity_2m,
            unit: weatherData.current_units.relative_humidity_2m
          },
          feelsLike: {
            value: weatherData.current.apparent_temperature,
            unit: weatherData.current_units.apparent_temperature
          },
          precipitation: {
            value: weatherData.current.precipitation,
            unit: weatherData.current_units.precipitation
          },
          wind: {
            speed: {
              value: weatherData.current.wind_speed_10m,
              unit: weatherData.current_units.wind_speed_10m
            },
            direction: {
              value: weatherData.current.wind_direction_10m,
              unit: weatherData.current_units.wind_direction_10m
            }
          }
        }
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch weather data: ${error.message}`);
      }
      throw new Error('Failed to fetch weather data: Unknown error');
    }
  },
  {
    name: "get_weather",
    description: "Get current weather information for a specific location",
    schema: z.object({
      location: z.string().describe("The name of the city or place to get weather for"),
    }),
  }
);

export default weatherTool;