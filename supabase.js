
import { createClient } from
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "'https://gnolcaozgtfbswusdfey.supabase.co'";
const SUPABASE_KEY = "'sb_publishable_yz2s8eb99UnlrNibA8kFWw_nocOfML2'";

export const supabaseClient = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);
