-- Tabela de configuração dos relatórios
CREATE TABLE public.report_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_relatorio TEXT NOT NULL UNIQUE,
  pontos_no_horario INTEGER NOT NULL DEFAULT 20,
  pontos_esqueceu_ou_erro INTEGER NOT NULL DEFAULT -40,
  pontos_fora_do_horario INTEGER NOT NULL DEFAULT -10,
  horario_limite TEXT NOT NULL DEFAULT 'ATÉ 09:00',
  responsaveis TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de controle diário de envios
CREATE TABLE public.controle_diario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  tipo_relatorio TEXT NOT NULL,
  responsavel TEXT NOT NULL,
  horario_envio TIME,
  status TEXT NOT NULL CHECK (status IN ('NO_HORARIO', 'FORA_DO_HORARIO', 'ESQUECEU_ERRO')),
  pontos_calculados INTEGER NOT NULL,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(data, tipo_relatorio, responsavel)
);

-- View para ranking de pontos (resumo automático)
CREATE OR REPLACE VIEW public.ranking_pontos AS
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

-- Enable RLS
ALTER TABLE public.report_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controle_diario ENABLE ROW LEVEL SECURITY;

-- Políticas para report_config (admins e gestores podem tudo)
CREATE POLICY "Admins e gestores podem ver configurações"
  ON public.report_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'gestor')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.permission_profiles pp ON up.profile_id = pp.id
      WHERE up.user_id = auth.uid() AND pp.name = 'Programação'
    )
  );

CREATE POLICY "Admins e gestores podem criar configurações"
  ON public.report_config FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'gestor')
    )
  );

CREATE POLICY "Admins e gestores podem editar configurações"
  ON public.report_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'gestor')
    )
  );

CREATE POLICY "Admins e gestores podem deletar configurações"
  ON public.report_config FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'gestor')
    )
  );

-- Políticas para controle_diario
CREATE POLICY "Admins, gestores e programação podem ver controle diário"
  ON public.controle_diario FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'gestor')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.permission_profiles pp ON up.profile_id = pp.id
      WHERE up.user_id = auth.uid() AND pp.name = 'Programação'
    )
  );

CREATE POLICY "Admins, gestores e programação podem criar controle diário"
  ON public.controle_diario FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'gestor')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.permission_profiles pp ON up.profile_id = pp.id
      WHERE up.user_id = auth.uid() AND pp.name = 'Programação'
    )
  );

CREATE POLICY "Admins e gestores podem editar controle diário"
  ON public.controle_diario FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'gestor')
    )
  );

CREATE POLICY "Admins e gestores podem deletar controle diário"
  ON public.controle_diario FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'gestor')
    )
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_report_config_updated_at
  BEFORE UPDATE ON public.report_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_controle_diario_updated_at
  BEFORE UPDATE ON public.controle_diario
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para calcular pontos automaticamente
CREATE OR REPLACE FUNCTION public.calcular_pontos_relatorio(
  p_tipo_relatorio TEXT,
  p_horario_envio TIME,
  p_status TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_config RECORD;
  v_pontos INTEGER;
BEGIN
  SELECT * INTO v_config FROM public.report_config WHERE tipo_relatorio = p_tipo_relatorio;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  CASE p_status
    WHEN 'NO_HORARIO' THEN v_pontos := v_config.pontos_no_horario;
    WHEN 'FORA_DO_HORARIO' THEN v_pontos := v_config.pontos_fora_do_horario;
    WHEN 'ESQUECEU_ERRO' THEN v_pontos := v_config.pontos_esqueceu_ou_erro;
    ELSE v_pontos := 0;
  END CASE;
  
  RETURN v_pontos;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;