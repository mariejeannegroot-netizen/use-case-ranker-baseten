import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { customerContext, useCases } = await req.json();

    if (!customerContext || !Array.isArray(useCases) || useCases.length === 0) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const questions: Record<string, any> = {};
    useCases.forEach((uc: string, i: number) => {
      questions[`uc_${i}`] = {
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

    const body = {
      model: "decision-models/baseten-elephant-9b-latest",
      state: `Customer context:\n${customerContext}\n\nPossible use cases:\n${useCases
        .map((u: string, i: number) => `${i + 1}. ${u}`)
        .join("\n")}`,
      questions,
    };

    const response = await fetch("https://inference.baseten.co/v1/systemone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.BASETEN_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Baseten API error. Check your API key." },
        { status: 500 }
      );
    }

    const data = await response.json();
    const answers = data.answers || {};

    const scoreToPercent = (score: number) => {
      const map: Record<number, number> = { 0: 12, 1: 32, 2: 55, 3: 78, 4: 93 };
      return map[Math.round(score)] ?? 50;
    };

    const ranked = useCases
      .map((uc: string, i: number) => {
        const key = `uc_${i}`;
        const ans = answers[key];
        const rawScore = ans?.score ?? 2;
        const percent = scoreToPercent(rawScore);

        let why = "Moderate fit for this account.";
        if (rawScore >= 3.5) why = "Very strong strategic fit with current priorities.";
        else if (rawScore >= 2.5) why = "Good alignment with customer context.";
        else if (rawScore <= 1.5) why = "Low relevance given the current situation.";

        return { useCase: uc, percent, why, rawScore };
      })
      .sort((a, b) => b.percent - a.percent);

    return NextResponse.json({ ranked });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
