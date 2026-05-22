import OpenAI from 'openai';

const categoryKeys = ['avaus', 'motivaatio', 'arvolupaus', 'vastavaitteet', 'klousaus'];

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(4, Math.round(n)));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is missing in Vercel environment variables.' });
    }

    const { transcript } = req.body || {};
    if (!transcript || transcript.trim().length < 80) {
      return res.status(400).json({ error: 'Transcript is too short. Paste a longer transcript first.' });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

    const response = await client.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Olet erittäin kokenut suomalaisen B2B-puhelinmyynnin valmentaja. Arvioit jäsenmyynnin puhelua käyttäytymisen perusteella, et pelkän lopputuloksen. Palauta aina validi JSON.`
        },
        {
          role: 'user',
          content: `Arvioi tämä puhelu asteikolla 1-4 näissä kategorioissa:
- avaus
- motivaatio
- arvolupaus
- vastavaitteet
- klousaus

Palauta JSON täsmälleen muodossa:
{
  "scores": {"avaus": 1, "motivaatio": 1, "arvolupaus": 1, "vastavaitteet": 1, "klousaus": 1},
  "summary": "lyhyt yhteenveto suomeksi",
  "evidence": {"avaus": "perustelu", "motivaatio": "perustelu", "arvolupaus": "perustelu", "vastavaitteet": "perustelu", "klousaus": "perustelu"},
  "coachingFocus": "yksi tärkein kehityskohde",
  "nextActions": ["konkreettinen harjoitus 1", "konkreettinen harjoitus 2", "konkreettinen harjoitus 3"],
  "betterPhrases": ["parempi lause 1", "parempi lause 2", "parempi lause 3"]
}

Älä kaunistele. Ole konkreettinen. Arvioi erityisesti mitä myyjä teki tai jätti tekemättä.

TRANSKRIPTIO:
${transcript}`
        }
      ]
    });

    const parsed = JSON.parse(response.choices?.[0]?.message?.content || '{}');
    const cleanedScores = Object.fromEntries(categoryKeys.map((key) => [key, clampScore(parsed?.scores?.[key]) || 1]));

    return res.status(200).json({
      scores: cleanedScores,
      summary: parsed.summary || '',
      evidence: parsed.evidence || {},
      coachingFocus: parsed.coachingFocus || '',
      nextActions: Array.isArray(parsed.nextActions) ? parsed.nextActions : [],
      betterPhrases: Array.isArray(parsed.betterPhrases) ? parsed.betterPhrases : []
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'AI scoring failed.' });
  }
}
