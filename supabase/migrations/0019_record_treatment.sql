-- 0019_record_treatment.sql — H2: klinik kayıt + stok kullanımı tek transaction
-- createTreatmentRecord önce treatment_records insert, sonra ayrı statement'ta
-- treatment_product_usage insert ediyordu; usage başarısızsa (yetersiz stok →
-- apply_usage_stock exception) kaydı uygulama-katmanı soft-delete ile telafi
-- ediyordu, o telafinin hatası yutuluyordu → stoktan düşmemiş "fantom" SOAP kaydı.
-- record_payment ile aynı atomik desen: tek RPC, tek transaction → usage patlarsa
-- treatment_records insert'i de geri alınır, fantom kayıt kalmaz.
-- SECURITY INVOKER → treatment_insert + usage_insert RLS politikaları uygulanır.

create or replace function public.record_treatment(
  p_customer_id       uuid,
  p_procedure_type_id uuid,
  p_staff_id          uuid,
  p_area              text,
  p_soap              jsonb,   -- {subjective, objective, assessment, plan}
  p_parameters        jsonb,   -- procedure parametreleri
  p_usage             jsonb    -- [{product_id, batch_id, quantity}, ...]
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_org    uuid := public.current_org_id();
  v_record uuid;
  v_line   jsonb;
begin
  if v_org is null then
    raise exception 'Aktif merkez bulunamadı';
  end if;

  insert into public.treatment_records
    (org_id, customer_id, procedure_type_id, staff_id, area,
     soap_subjective, soap_objective, soap_assessment, soap_plan,
     parameters, created_by)
  values (
    v_org, p_customer_id, p_procedure_type_id, p_staff_id,
    nullif(p_area, ''),
    nullif(p_soap->>'subjective', ''),
    nullif(p_soap->>'objective', ''),
    nullif(p_soap->>'assessment', ''),
    nullif(p_soap->>'plan', ''),
    coalesce(p_parameters, '{}'::jsonb),
    auth.uid()
  )
  returning id into v_record;

  if p_usage is not null and jsonb_array_length(p_usage) > 0 then
    for v_line in select * from jsonb_array_elements(p_usage) loop
      insert into public.treatment_product_usage
        (org_id, treatment_record_id, product_id, batch_id, quantity, created_by)
      values (
        v_org, v_record,
        (v_line->>'product_id')::uuid,
        (v_line->>'batch_id')::uuid,
        (v_line->>'quantity')::numeric,
        auth.uid()
      );
    end loop;
  end if;

  return v_record;
end $$;

grant execute on function
  public.record_treatment(uuid, uuid, uuid, text, jsonb, jsonb, jsonb)
  to authenticated;
