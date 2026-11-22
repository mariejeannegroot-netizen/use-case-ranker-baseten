import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerContext, useCases } = body;

    // Basic validation
    if (!customerContext || typeof customerContext !== "string") {
      return NextResponse.json(
        { error: "customerContext is required and must be a string" },
        { status: 400 }
      );
    }

    if (!Array.isArray(useCases) || useCases.length === 0) {
      return NextResponse.json(
        { error: "useCases must be a non-empty array" },
        { status: 400 }
      );
    }

    // Build score questions
    const questions: Record<string, any> = {};
    useCases.forEach((uc: string, index: number) => {
      questions[`uc_${index}`] = {
        type: "score",
        instructions:
          "How interesting and high-potential is this specific use case for the customer right now? Score from 0 (not interesting) to 4 (extremely interesting / clear priority).",
        criteria: [
          "0 - Not relevant or low priority",
          "1 - Mildly interesting",
          "2 - Moderately interesting",
          "3 - Strong interest / good fit",
          "4 - Extremely interesting / clear priority",
        ],
      };
    });

    const payload = {
      model: "decision-models/baseten-elephant-9b-latest",
      state: `Customer context:\n${customerContext}\n\nPossible use cases:\n${useCases
        .map((uc: string, i: number) => `${i + 1}. ${uc}`)
        .join("\n")}`,
      questions,
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
      console.error("Baseten API error:", response.status, responseText);
      return NextResponse.json(
        {
          error: "Baseten API error",
          status: response.status,
          details: responseText,
        },
        { status: 500 }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid JSON response from Baseten", details: responseText },
        { status: 500 }
      );
    }

    const answers = data.answers || {};

    const scoreToPercent = (score: number): number => {
      const rounded = Math.round(score);
      const map: Record<number, number> = {
        0: 12,
        1: 32,
        2: 55,
        3: 78,
        4: 93,
      };
      return map[rounded] ?? 50;
    };

    const ranked = useCases
      .map((uc: string, index: number) => {
        const key = `uc_${index}`;
        const answer = answers[key];

        // Baseten score answers usually have a "score" field
        const rawScore =
          typeof answer?.score === "number" ? answer.score : 2;

        const percent = scoreToPercent(rawScore);

        let why = "Moderate fit for this account.";
        if (rawScore >= 3.5) {
          why = "Very strong strategic fit with current priorities.";
        } else if (rawScore >= 2.5) {
          why = "Good alignment with customer context.";
        } else if (rawScore <= 1.5) {
          why = "Low relevance given the current situation.";
        }

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
    console.error("Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Server error",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
