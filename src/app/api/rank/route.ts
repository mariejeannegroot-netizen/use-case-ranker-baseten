import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerContext, useCases } = body;

    if (!customerContext || typeof customerContext !== "string") {
      return NextResponse.json(
        { error: "customerContext is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(useCases) || useCases.length === 0) {
      return NextResponse.json(
        { error: "useCases must be a non-empty array" },
        { status: 400 }
      );
    }

    // Create one strong score question per use case
    const questions: Record<string, any> = {};
    useCases.forEach((uc: string, index: number) => {
      questions[`uc_${index}`] = {
        type: "score",
        instructions: `You are an expert enterprise sales strategist working for Baseten with 15 years of experience. You are a top performer, specialized in understanding customer context and needs and ranking interesting use cases for them.
        
Customer context:
${customerContext}

Evaluate how interesting and strategically relevant THIS specific use case is for the customer right now:

"${uc}"

Focus especially on:
- Does it solve a clear pain mentioned in the context? Or is it somewhat related to the pain?
- Does it align to the customer priority, e.g. Lower compute cost, Deliver instant, snappy end-user interactions, Ship product faster, Own their AI IP, Handle viral spikes without downtime or customer churn, reduce workload / attrition / operational pressure?
- Does it seem from the context a high-priority initiative for this type of company/ role/ other things mentioned in the context?

Score from 0 to 4.`,
        criteria: [
          "0 - Completely irrelevant",
          "1 - Mildly interesting but low priority",
          "2 - Moderately relevant",
          "3 - Strong strategic fit",
          "4 - Extremely relevant and high priority right now"
        ]
      };
    });

    const payload = {
      model: "decision-models/baseten-elephant-9b-latest",
      state: customerContext, // Keep state clean
      questions
    };

    const response = await fetch("https://inference.baseten.co/v1/systemone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.BASETEN_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("Baseten error:", response.status, responseText);
      return NextResponse.json(
        {
          error: "Baseten API error",
          status: response.status,
          details: responseText,
        },
        { status: 500 }
      );
    }

    const data = JSON.parse(responseText);
    const answers = data.answers || {};

    const scoreToPercent = (score: number): number => {
      const rounded = Math.round(score);
      const map: Record<number, number> = {
        0: 10,
        1: 30,
        2: 55,
        3: 78,
        4: 94,
      };
      return map[rounded] ?? 50;
    };

    const ranked = useCases
      .map((uc: string, index: number) => {
        const key = `uc_${index}`;
        const answer = answers[key];
        const rawScore = typeof answer?.score === "number" ? answer.score : 2;
        const percent = scoreToPercent(rawScore);

        let why = "Moderate fit for this account.";
        if (rawScore >= 3.5) why = "Very strong strategic fit with current priorities.";
        else if (rawScore >= 2.5) why = "Good alignment with customer context.";
        else if (rawScore <= 1.5) why = "Low relevance given the current situation.";

        return {
          useCase: uc,
          percent,
          why,
          rawScore,
        };
      })
      .sort((a, b) => b.percent - a.percent);

    return NextResponse.json({ ranked });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: "Server error", details: error?.message },
      { status: 500 }
    );
  }
}
