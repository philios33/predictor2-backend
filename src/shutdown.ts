
export function handleGracefulShutdownSignals(handler: () => Promise<void>, timeoutSecs: number = 10) : void {
    const shutdownSignal = async (signal: string) => {
        console.log("Shutdown signal received: " + signal);
        setTimeout(() => {
            console.log("Shutdown timeout after " + timeoutSecs + " seconds, forced process exit");
            process.exit(1);
        }, timeoutSecs * 1000);
        try {
            await handler();
            console.log("Clean shutdown");
        } catch(e: any) {
            console.error(e);
            console.log("Error during shutdown: " + e.message);
        }
        process.exit(1);
    }
    
    process.on("SIGINT", () => {
        shutdownSignal("SIGINT");
    });
    process.on("SIGTERM", () => {
        shutdownSignal("SIGTERM");
    });
}