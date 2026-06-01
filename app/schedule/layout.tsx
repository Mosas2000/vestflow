import { getSchedule } from "@/lib/stellar";
import { Metadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  try {
    const { id } = await params;
    const scheduleId = parseInt(id, 10);
    if (isNaN(scheduleId)) {
      return {
        title: "Schedule Not Found — VestFlow",
        description: "The requested vesting schedule could not be found.",
      };
    }

    const schedule = await getSchedule(scheduleId);
    
    if (!schedule) {
      return {
        title: "Schedule Not Found — VestFlow",
        description: "The requested vesting schedule could not be found.",
      };
    }

    const totalAmount = (Number(schedule.total_amount) / 10_000_000).toFixed(2);
    const title = `VestFlow Schedule #${scheduleId}`;
    const description = `${totalAmount} XLM vesting to ${schedule.beneficiary.slice(0, 8)}... from ${schedule.grantor.slice(0, 8)}...`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        url: `https://vestflow.xyz/schedule/${scheduleId}`,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {
      title: "VestFlow Schedule",
      description: "View vesting schedule details on VestFlow",
    };
  }
}

export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
