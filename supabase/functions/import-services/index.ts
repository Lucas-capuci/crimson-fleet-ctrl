import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { csvData } = await req.json();

    if (!csvData) {
      return new Response(
        JSON.stringify({ error: "CSV data is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Parse CSV
    const lines = csvData.split('\n');
    const services = new Map();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(';');
      if (parts.length < 5) continue;

      const up = parts[0].trim();
      const serviceNumber = parts[1].trim();
      const description = parts[2].trim();
      const unit = parts[3].trim();
      const priceStr = parts[4].trim().replace('.', '').replace(',', '.');
      const grossPrice = parseFloat(priceStr);

      if (!up || isNaN(grossPrice)) continue;

      // Only keep unique UPs (first occurrence)
      if (!services.has(up)) {
        services.set(up, {
          up,
          service_number: serviceNumber,
          description,
          unit,
          gross_price: grossPrice,
        });
      }
    }

    const dataToInsert = Array.from(services.values());

    // Upsert services
    const { data, error } = await supabase
      .from('service_catalog')
      .upsert(dataToInsert, { onConflict: 'up' })
      .select();

    if (error) {
      console.error("Error inserting services:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${dataToInsert.length} services imported successfully`,
        count: dataToInsert.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

