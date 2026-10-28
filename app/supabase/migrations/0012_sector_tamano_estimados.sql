-- =====================================================================
-- CDE UNAB · Sector y tamaño ESTIMADOS para la demo (88 empresas sin esos datos)
--   Inferidos solo a partir del nombre de la empresa: no son datos reales.
--   Solo se llenan campos vacíos (nunca se sobrescribe un dato real) y cada campo
--   llenado queda anotado en empresas.datos_estimados. Para deshacerlo:
--     update public.empresas set sector = null where 'sector' = any (datos_estimados);
--     update public.empresas set tamano = null where 'tamano' = any (datos_estimados);
--     update public.empresas set datos_estimados = '{}';
-- =====================================================================

alter table public.empresas add column datos_estimados text[] not null default '{}';
comment on column public.empresas.datos_estimados is 'Campos llenados con datos estimados para la demo (no confirmados por el CDE)';

with estimados (id, sector, tamano) as (values
  ('83d8eae5-aa56-5718-bb1a-dbc67e9cffb5'::uuid, 'Comercio', 'Micro'::public.tamano_empresa), -- Agrofajardo Talabarteria
  ('67158851-2cef-534e-a5ea-176078e0ddf4'::uuid, 'Comercio', 'Emprendimiento'::public.tamano_empresa), -- Alira
  ('c058546b-4ac8-5ef6-814b-4e9a0f434bf1'::uuid, 'Manufactura / Industrial', 'Emprendimiento'::public.tamano_empresa), -- ALQUIMIA ESSENCE
  ('08e749b5-8567-5e22-b06b-df596c421e9d'::uuid, 'Alimentos', 'Micro'::public.tamano_empresa), -- Amor de campo
  ('2f216a44-99c8-5f0b-b87a-c7cbd4cfdc71'::uuid, 'Alimentos', 'Emprendimiento'::public.tamano_empresa), -- ARTE Y DULCE CON AMOR
  ('b9fa3e1f-f190-59fc-abeb-3290c1987002'::uuid, 'Servicios', 'Micro'::public.tamano_empresa), -- Asesorias & Seguros Carrillo
  ('3d3e3132-8718-598d-92a2-30bac9ecb2db'::uuid, 'Agropecuario / Minero', 'Micro'::public.tamano_empresa), -- Asociación Agroecológica de Afrodecendientes
  ('e18c1722-580b-57a5-b204-8c8626019173'::uuid, 'Agropecuario / Minero', 'Micro'::public.tamano_empresa), -- ASOPAREM - AMAFLOR
  ('add7e355-772c-5e22-a188-271314461158'::uuid, 'Servicios', 'Micro'::public.tamano_empresa), -- AUDITORIA APOYO EMPRESARIAL - Vitakai
  ('497f363a-1678-5cfc-974d-0559b7fa6710'::uuid, 'Alimentos', 'Pequeña'::public.tamano_empresa), -- B HONEY SAS BIC
  ('eef6d1dd-9dae-5cb1-b5b8-63488083c566'::uuid, 'Comercio', 'Micro'::public.tamano_empresa), -- BABY JANOR
  ('62e07885-c02c-5b51-ae4b-f0848ed956c6'::uuid, 'Audiovisuales, Arte y Cultura', 'Emprendimiento'::public.tamano_empresa), -- Belembe
  ('db37e0a5-a32f-56b4-a1ff-2115e5ce616f'::uuid, 'Alimentos', 'Emprendimiento'::public.tamano_empresa), -- Berry pop
  ('69e6fa9f-299b-56d7-94bf-e2e0bea8dc66'::uuid, 'Alimentos', 'Micro'::public.tamano_empresa), -- Café Aguadeño
  ('a144182b-0332-5416-b5a6-f760b42319a2'::uuid, 'Alimentos', 'Micro'::public.tamano_empresa), -- Café Fundador
  ('153ad5bd-b5c2-5a93-af2e-a34c58c7bd67'::uuid, 'Alimentos', 'Micro'::public.tamano_empresa), -- CAFE SAN ANGEL DE LA NOVENA
  ('8d8e0934-e348-5450-9fd4-fd899f492f6c'::uuid, 'Alimentos', 'Emprendimiento'::public.tamano_empresa), -- Cafe vitana
  ('0e385ef5-e2cc-5d3d-b7da-f7e503bf5189'::uuid, 'Servicios', 'Pequeña'::public.tamano_empresa), -- CEAPROMOVER S.A.S.
  ('a9a338d5-26ad-5513-91b9-995be74ce699'::uuid, 'Servicios', 'Micro'::public.tamano_empresa), -- Centro de Bienestar ALAS MÁGICAS
  ('656ad0f7-22c3-5ccb-84bb-f8015a5f29e1'::uuid, 'Alimentos', 'Emprendimiento'::public.tamano_empresa), -- Chocarif
  ('cdf8eab2-473e-5ff6-9747-46b91ba8d4fd'::uuid, 'Alimentos', 'Micro'::public.tamano_empresa), -- Chocoland
  ('c99c7fd9-c078-5faf-8bdd-f51be0c89052'::uuid, 'Alimentos', 'Emprendimiento'::public.tamano_empresa), -- Churrideditos y algo mas
  ('cd098d4c-a656-58cd-883a-cc5427d69998'::uuid, 'Construcción', 'Pequeña'::public.tamano_empresa), -- Cimbras SAS
  ('7e30b48d-7082-5879-8c28-d5d518721bd8'::uuid, 'Tecnológico', 'Mediana'::public.tamano_empresa), -- Colombia Biomedical S.A.S
  ('a74cfbf7-f488-502b-8de7-5ddda01dc9d3'::uuid, 'Alimentos', 'Emprendimiento'::public.tamano_empresa), -- Cookie Bites
  ('d7ba8e03-e09a-506f-8cbe-92119b27fa69'::uuid, 'ONG', 'Micro'::public.tamano_empresa), -- Corporación Raíces Verdes
  ('3963146f-6ab1-5b01-ada8-9de524aaf49c'::uuid, 'Audiovisuales, Arte y Cultura', 'Micro'::public.tamano_empresa), -- CRESCENDO
  ('adbd4399-4f8e-55ff-837b-b4e7adbc7833'::uuid, 'Tecnológico', 'Micro'::public.tamano_empresa), -- Digital zone
  ('91251d3c-2fb4-56bc-adab-61c1692a78dc'::uuid, 'Servicios', 'Emprendimiento'::public.tamano_empresa), -- DIRECTORA DE BELLEZA ELBA BECERRA
  ('f6de12ef-489f-50e7-bfe0-8f02785f53a8'::uuid, 'Manufactura / Industrial', 'Emprendimiento'::public.tamano_empresa), -- Diseños madilau
  ('44c46728-688b-57b8-b525-dc258ebdebf6'::uuid, 'Manufactura / Industrial', 'Micro'::public.tamano_empresa), -- Diseños y confecciones Maya
  ('520db3f8-5a76-5d74-8fef-0bcaf51d8acc'::uuid, 'Comercio', 'Pequeña'::public.tamano_empresa), -- distribuidora de furtas y verduras mi chino sas
  ('5e5634d6-fe0f-5c62-a855-b669293b4da5'::uuid, 'Comercio', 'Pequeña'::public.tamano_empresa), -- DISTRIBUIDORA PLASCOL H Y Y
  ('81c0492f-b9f6-57c7-ae71-16e82b54a4d5'::uuid, 'Servicios', 'Micro'::public.tamano_empresa), -- Draw Law El Arte del Derecho S.A.S.
  ('cfed433f-2fbf-5052-baf6-e27c36223947'::uuid, 'Comercio', 'Micro'::public.tamano_empresa), -- EBANO DISTRIBUIDORA Y FLORISTERIA
  ('89e7c43f-99c8-54cd-80c4-d28da3b31eed'::uuid, 'Comercio', 'Pequeña'::public.tamano_empresa), -- EL Corcel Talabarteria y AGRO
  ('14629d4b-3386-5c17-9c2e-52c9890a91ae'::uuid, 'Construcción', 'Mediana'::public.tamano_empresa), -- EL NOGAL MATERIALES DE CONSTRUCCION SAS
  ('f4f71e7e-39fc-5e66-ab2b-5822afa0606a'::uuid, 'Alimentos', 'Micro'::public.tamano_empresa), -- El papá de los buñuelos
  ('7485fb3c-4cfe-5611-a19b-4dca20f2e562'::uuid, 'Alimentos', 'Emprendimiento'::public.tamano_empresa), -- El picateño
  ('e6910973-4636-5cc5-b2ee-95d20f93b6af'::uuid, 'Comercio', 'Emprendimiento'::public.tamano_empresa), -- Energy vital esencial
  ('cf8ef49f-2ed7-5a37-bd25-195cc2b268bc'::uuid, 'Servicios', 'Micro'::public.tamano_empresa), -- Escuela Formadora de Baristas
  ('65cf56af-fc57-5856-88c9-7453c334c23d'::uuid, 'Turismo', 'Emprendimiento'::public.tamano_empresa), -- ESPELETIA GRANDIFLORA
  ('4264f994-6aa0-5e00-bbb0-3a03634b5dd0'::uuid, 'Servicios', 'Micro'::public.tamano_empresa), -- FENIX CLEAN
  ('4677a7da-cce2-56f7-bc48-1bbbec0714ca'::uuid, 'Comercio', 'Micro'::public.tamano_empresa), -- FERRETERIA ELECTROGOMEZ HSJ
  ('c9a3ba64-8afb-54d3-83a2-01484a37c95a'::uuid, 'Audiovisuales, Arte y Cultura', 'Micro'::public.tamano_empresa), -- Fotos & Cuadros
  ('3d6300b6-9012-56b4-95d7-d2b5732873e4'::uuid, 'Alimentos', 'Emprendimiento'::public.tamano_empresa), -- Fresabelle
  ('d26b3669-2767-560a-bf12-0a644b531d93'::uuid, 'Servicios', 'Pequeña'::public.tamano_empresa), -- FRIOPRADA SAS
  ('1536df00-f8b2-507d-89b1-4b4d917d7fe3'::uuid, 'ONG', 'Micro'::public.tamano_empresa), -- Fundacion adulto mayor y parkinson santander -FAMPAS
  ('9c25f1a2-6154-5b0c-8093-9d1c9d42cba2'::uuid, 'Alimentos', 'Micro'::public.tamano_empresa), -- GIOVANNA YANGUAS CAFÉ
  ('fe67ac06-f83f-57d6-bbad-5d913826a27e'::uuid, 'Comercio', 'Emprendimiento'::public.tamano_empresa), -- Haltiare
  ('b126aa4b-b10b-5279-95f2-3ce98977e6ba'::uuid, 'Manufactura / Industrial', 'Micro'::public.tamano_empresa), -- Ideales Muebles t Decoración
  ('8de4de6f-fea5-534d-81fb-df8df057da2d'::uuid, 'Manufactura / Industrial', 'Micro'::public.tamano_empresa), -- Impermeables Santander
  ('09466af3-f7f2-51be-ad86-2a0a49869bf0'::uuid, 'Sector Inmobiliario', 'Pequeña'::public.tamano_empresa), -- Inversiones DSAR SAS
  ('d5a57113-93a6-5839-a1b6-f186c2b19d57'::uuid, 'Servicios', 'Micro'::public.tamano_empresa), -- JEFFER D'CARS
  ('b3eea2c5-6add-59c5-9cc4-2d747ff30ba2'::uuid, 'Servicios', 'Emprendimiento'::public.tamano_empresa), -- Juan Sebastián Gutierrez Rangel / M31
  ('3b069676-ff35-599c-86e4-0da530419a6f'::uuid, 'Servicios', 'Emprendimiento'::public.tamano_empresa), -- JULIO CESAR SERVICIOS
  ('dbaf49e3-995c-5423-a82d-3df513203ec8'::uuid, 'Alimentos', 'Emprendimiento'::public.tamano_empresa), -- Karolcake
  ('6cd24301-97e2-5b80-9a63-5250b15f1bf4'::uuid, 'Tecnológico', 'Micro'::public.tamano_empresa), -- Klixmant SAS
  ('25122615-e866-574f-8a14-f658c9f60c3e'::uuid, 'Servicios', 'Micro'::public.tamano_empresa), -- La kumbre centro de servicio
  ('36847251-89c7-56c6-8983-84ed76fcb7bd'::uuid, 'Alimentos', 'Micro'::public.tamano_empresa), -- La Mantilla
  ('9b8f234b-dace-5052-be98-1a595b498e0b'::uuid, 'Alimentos', 'Micro'::public.tamano_empresa), -- LACHILA productos Alimenticios
  ('c8bb9a81-525f-55d2-a7d4-acf56b3b16c5'::uuid, 'Servicios', 'Micro'::public.tamano_empresa), -- LeoSAS
  ('4ba2be45-316e-5bd0-89f4-f9974be4d1fa'::uuid, 'Comercio', 'Emprendimiento'::public.tamano_empresa), -- madrid
  ('1fa0cd97-155a-5d3b-8ba5-ed4d2c35f255'::uuid, 'Servicios', 'Emprendimiento'::public.tamano_empresa), -- Margret Ayala
  ('295a6414-a63f-5e65-a1b6-25ad7c42d027'::uuid, 'Alimentos', 'Emprendimiento'::public.tamano_empresa), -- MARYORIS RICO PRADILLA - VITACACAO
  ('f4810177-3927-53eb-9067-7db537451ae9'::uuid, 'Recreación y Deportes', 'Micro'::public.tamano_empresa), -- MASSTERFIT
  ('76e3e9cf-2885-579d-935f-47e18adccb34'::uuid, 'Turismo', 'Micro'::public.tamano_empresa), -- Mirador Juyamuca
  ('59bbcafd-be20-579b-8aeb-e96dbf1ad1da'::uuid, 'Servicios', 'Micro'::public.tamano_empresa), -- MJ ASESORIAS CONTABLES
  ('3380c25a-167a-5b9b-95fa-5dac29178aff'::uuid, 'Servicios', 'Micro'::public.tamano_empresa), -- MotoPolish Santander
  ('c9386262-73df-54dc-8e42-cd1eb5c5c640'::uuid, 'Alimentos', 'Micro'::public.tamano_empresa), -- PANTEPASBU
  ('ec0d0eb0-061f-5bd4-b586-4ae7f6b199f8'::uuid, 'Sector Transporte y Logística', 'Micro'::public.tamano_empresa), -- PARQUEADERO PARKING LA FLORA
  ('ec686735-69e9-521d-865e-fb30345a2ed4'::uuid, 'Comercio', 'Pequeña'::public.tamano_empresa), -- PROASEO Y SUMINSITROS DE SANTANDER SAS
  ('294c3d38-e787-574b-b116-7b5419fd8adf'::uuid, 'Alimentos', 'Emprendimiento'::public.tamano_empresa), -- ricachona
  ('06cf5ded-d9a4-5011-ac94-c823210efee4'::uuid, 'Alimentos', 'Micro'::public.tamano_empresa), -- RICURAS PAISAS I
  ('108dd4a8-d6d7-5feb-b72b-8f2833037e67'::uuid, 'Turismo', 'Micro'::public.tamano_empresa), -- RUTAS AVENTURAS ECOCOLOMBIA
  ('643e1223-24b2-5a23-978d-e22deb415c7b'::uuid, 'Alimentos', 'Emprendimiento'::public.tamano_empresa), -- Sabajón DE MI TIERRA
  ('918d7de2-287d-58d7-b4d9-37788bc2928f'::uuid, 'Alimentos', 'Emprendimiento'::public.tamano_empresa), -- SABOREARTE EN LINEA
  ('94c85a4c-f5c0-59cb-9698-5bc21d090fde'::uuid, 'Comercio', 'Emprendimiento'::public.tamano_empresa), -- Sara_accesorios.bga
  ('08231bb7-29b3-5e34-8343-ddd4ae2af863'::uuid, 'Servicios', 'Micro'::public.tamano_empresa), -- servicios frankfor sas
  ('eb7eb747-0428-5af2-ad13-6e93faed2578'::uuid, 'Turismo', 'Micro'::public.tamano_empresa), -- The Cranky Hummingbird SAS BIC
  ('08451f22-1a8b-539b-8622-42a786a2d4ee'::uuid, 'Comercio', 'Pequeña'::public.tamano_empresa), -- Thermoaires y repuestos SAS
  ('07f80291-78f3-5811-9289-e2896c5094a5'::uuid, 'Comercio', 'Micro'::public.tamano_empresa), -- TIENDA DE CALZADO ZOE
  ('92219585-636f-5ca7-87a9-be33e89dda15'::uuid, 'Alimentos', 'Micro'::public.tamano_empresa), -- Ton Ales
  ('7f7bf02a-f15b-54a5-81a8-6846963d186d'::uuid, 'Tecnológico', 'Micro'::public.tamano_empresa), -- UZIVO SAS
  ('aeb76b9c-4fa4-5d8b-a75f-a003fae20cc2'::uuid, 'Comercio', 'Emprendimiento'::public.tamano_empresa), -- Variedades luzerito
  ('e70dbf0a-b1d6-5318-a67d-376f2670aef4'::uuid, 'Turismo', 'Emprendimiento'::public.tamano_empresa), -- Viaja con Kathe
  ('2ab74e6a-8976-5cef-91a5-0b02842d7684'::uuid, 'Desarrollo WEB', 'Emprendimiento'::public.tamano_empresa), -- Webnova
  ('0faeab27-960c-55b5-9586-1726a86b196d'::uuid, 'Manufactura / Industrial', 'Micro'::public.tamano_empresa)  -- Yeseraye
)
update public.empresas e
set sector = coalesce(e.sector, x.sector),
    tamano = coalesce(e.tamano, x.tamano),
    datos_estimados = e.datos_estimados
      || case when e.sector is null then array['sector'] else '{}'::text[] end
      || case when e.tamano is null then array['tamano'] else '{}'::text[] end
from estimados x
where e.id = x.id and (e.sector is null or e.tamano is null);

