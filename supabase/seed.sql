-- ============================================================================
-- Finanças Pessoais — seed de categorias e subcategorias padrão.
-- Rode depois de schema.sql. Seguro para rodar mais de uma vez
-- (verifica se a categoria já existe pelo nome + tipo).
-- ============================================================================

do $$
declare
  cat_id uuid;
begin
  -- ---------------------------------------------------------------------
  -- DESPESAS
  -- ---------------------------------------------------------------------
  insert into public.categories (name, type, color, icon, sort_order)
    select 'Alimentação', 'despesa', '#2a78d6', 'utensils', 1
    where not exists (select 1 from public.categories where name = 'Alimentação' and type = 'despesa')
    returning id into cat_id;
  if cat_id is not null then
    insert into public.subcategories (category_id, name, sort_order) values
      (cat_id, 'Mercado', 1),
      (cat_id, 'Restaurante', 2),
      (cat_id, 'Delivery', 3),
      (cat_id, 'Padaria', 4);
  end if;

  insert into public.categories (name, type, color, icon, sort_order)
    select 'Transporte', 'despesa', '#eb6834', 'car', 2
    where not exists (select 1 from public.categories where name = 'Transporte' and type = 'despesa')
    returning id into cat_id;
  if cat_id is not null then
    insert into public.subcategories (category_id, name, sort_order) values
      (cat_id, 'Combustível', 1),
      (cat_id, 'Uber/Táxi', 2),
      (cat_id, 'Transporte Público', 3),
      (cat_id, 'Manutenção', 4),
      (cat_id, 'Estacionamento', 5);
  end if;

  insert into public.categories (name, type, color, icon, sort_order)
    select 'Moradia', 'despesa', '#1baf7a', 'home', 3
    where not exists (select 1 from public.categories where name = 'Moradia' and type = 'despesa')
    returning id into cat_id;
  if cat_id is not null then
    insert into public.subcategories (category_id, name, sort_order) values
      (cat_id, 'Aluguel', 1),
      (cat_id, 'Condomínio', 2),
      (cat_id, 'Energia Elétrica', 3),
      (cat_id, 'Água', 4),
      (cat_id, 'Internet', 5),
      (cat_id, 'Gás', 6);
  end if;

  insert into public.categories (name, type, color, icon, sort_order)
    select 'Lazer', 'despesa', '#eda100', 'party-popper', 4
    where not exists (select 1 from public.categories where name = 'Lazer' and type = 'despesa')
    returning id into cat_id;
  if cat_id is not null then
    insert into public.subcategories (category_id, name, sort_order) values
      (cat_id, 'Streaming', 1),
      (cat_id, 'Cinema/Shows', 2),
      (cat_id, 'Viagens', 3),
      (cat_id, 'Hobbies', 4);
  end if;

  insert into public.categories (name, type, color, icon, sort_order)
    select 'Saúde', 'despesa', '#e87ba4', 'heart-pulse', 5
    where not exists (select 1 from public.categories where name = 'Saúde' and type = 'despesa')
    returning id into cat_id;
  if cat_id is not null then
    insert into public.subcategories (category_id, name, sort_order) values
      (cat_id, 'Plano de Saúde', 1),
      (cat_id, 'Farmácia', 2),
      (cat_id, 'Consultas', 3),
      (cat_id, 'Academia', 4);
  end if;

  insert into public.categories (name, type, color, icon, sort_order)
    select 'Educação', 'despesa', '#008300', 'graduation-cap', 6
    where not exists (select 1 from public.categories where name = 'Educação' and type = 'despesa')
    returning id into cat_id;
  if cat_id is not null then
    insert into public.subcategories (category_id, name, sort_order) values
      (cat_id, 'Mensalidade', 1),
      (cat_id, 'Cursos', 2),
      (cat_id, 'Livros e Material', 3);
  end if;

  insert into public.categories (name, type, color, icon, sort_order)
    select 'Outros', 'despesa', '#4a3aa7', 'more-horizontal', 7
    where not exists (select 1 from public.categories where name = 'Outros' and type = 'despesa')
    returning id into cat_id;
  if cat_id is not null then
    insert into public.subcategories (category_id, name, sort_order) values
      (cat_id, 'Diversos', 1),
      (cat_id, 'Presentes', 2),
      (cat_id, 'Assinaturas', 3);
  end if;

  -- ---------------------------------------------------------------------
  -- RECEITAS
  -- ---------------------------------------------------------------------
  insert into public.categories (name, type, color, icon, sort_order)
    select 'Salário', 'receita', '#2a78d6', 'wallet', 1
    where not exists (select 1 from public.categories where name = 'Salário' and type = 'receita')
    returning id into cat_id;
  if cat_id is not null then
    insert into public.subcategories (category_id, name, sort_order) values
      (cat_id, 'Salário Fixo', 1),
      (cat_id, 'Bônus', 2),
      (cat_id, '13º Salário', 3);
  end if;

  insert into public.categories (name, type, color, icon, sort_order)
    select 'Freelance', 'receita', '#eb6834', 'briefcase', 2
    where not exists (select 1 from public.categories where name = 'Freelance' and type = 'receita')
    returning id into cat_id;
  if cat_id is not null then
    insert into public.subcategories (category_id, name, sort_order) values
      (cat_id, 'Projetos', 1),
      (cat_id, 'Consultoria', 2);
  end if;

  insert into public.categories (name, type, color, icon, sort_order)
    select 'Outros', 'receita', '#1baf7a', 'more-horizontal', 3
    where not exists (select 1 from public.categories where name = 'Outros' and type = 'receita')
    returning id into cat_id;
  if cat_id is not null then
    insert into public.subcategories (category_id, name, sort_order) values
      (cat_id, 'Reembolsos', 1),
      (cat_id, 'Investimentos', 2),
      (cat_id, 'Diversos', 3);
  end if;
end $$;
