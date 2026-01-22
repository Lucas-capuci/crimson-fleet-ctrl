-- Add validated_value column to oses table for EQTL validation
ALTER TABLE public.oses 
ADD COLUMN validated_value numeric DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.oses.validated_value IS 'Value validated by EQTL';