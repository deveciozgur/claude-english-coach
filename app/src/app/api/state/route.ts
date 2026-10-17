import { asList, body, route } from '@/lib/server/http';
import { appendVocabulary, logErrors, readErrors, readProfile, readVocabulary, updateProfile } from '@/lib/server/store';


const readState = async () => {
  const [profile, vocabulary, errors] = await Promise.all([readProfile(), readVocabulary(), readErrors()]);
  return { profile, vocabulary, errors };
};

/** The learner's whole state, read from the server disk. */
export const GET = route(async () => Response.json(await readState()));

/** One write path: partial profile (merged, validated), new words (2.50 / 0 / 1d) and ledger entries. */
export const PUT = route(async (req) => {
  const { profile, vocabulary, errors } = await body(req);
  if (profile) await updateProfile(profile);
  if (vocabulary) await appendVocabulary(asList(vocabulary));
  if (errors) await logErrors(asList(errors));
  return Response.json(await readState());
});
