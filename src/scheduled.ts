import { Bindings } from "./types"
import { fetchLatestHostsData, storeData } from "./services/hosts"

export async function handleSchedule(
  event: ScheduledEvent,
  env: Bindings
): Promise<void> {
  console.log("Running scheduled task...")

  try {
    // 可以通过环境变量控制是否启用优选功能
    const useOptimization = env.ENABLE_OPTIMIZATION === 'true'
    
    console.log(`Optimization ${useOptimization ? 'enabled' : 'disabled'} for scheduled task`)
    
    const newEntries = await fetchLatestHostsData(useOptimization)
    await storeData(env, newEntries)

    console.log(`Scheduled task completed successfully with ${newEntries.length} entries`)
  } catch (error) {
    console.error("Error in scheduled task:", error)
  }
}
