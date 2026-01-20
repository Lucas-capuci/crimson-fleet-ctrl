-- Corrigir a view para usar SECURITY INVOKER (padrão seguro)
DROP VIEW IF EXISTS public.ranking_pontos;

CREATE VIEW public.ranking_pontos 
WITH (security_invoker = true) AS
SELECT 
  responsavel,
  SUM(pontos_calculados) as total_pontos,
  COUNT(*) FILTER (WHERE status = 'NO_HORARIO') as quantidade_no_horario,
  COUNT(*) FILTER (WHERE status = 'FORA_DO_HORARIO') as quantidade_fora_do_horario,
  COUNT(*) FILTER (WHERE status = 'ESQUECEU_ERRO') as quantidade_erros,
  COUNT(*) as total_registros
FROM public.controle_diario
GROUP BY responsavel
ORDER BY total_pontos DESC;