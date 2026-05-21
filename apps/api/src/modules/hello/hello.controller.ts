import { Controller, Get } from "@nestjs/common";
import { HelloResponse } from "@ci-train/contracts";

@Controller("hello")
export class HelloController {
  @Get()
  hello(): HelloResponse {
    return {
      message: "Hello from the ci-train API.",
      from: "api",
      apiVersion: "0.0.0",
      timestamp: new Date().toISOString(),
    };
  }
}
