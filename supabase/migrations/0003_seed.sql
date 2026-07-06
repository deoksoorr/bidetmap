-- 비데맵 v1.0 카테고리/상태값 시드 (Phase 0, 한국어)
insert into category_settings ("group", code, label, sort) values
 ('place_type','public_toilet','공중화장실',1),
 ('place_type','subway','지하철/역사',2),
 ('place_type','mall','백화점/몰',3),
 ('place_type','cafe','카페',4),
 ('place_type','restaurant','음식점',5),
 ('place_type','hotel','호텔',6),
 ('place_type','motel','모텔',7),
 ('place_type','hospital','병원',8),
 ('place_type','government','관공서',9),
 ('place_type','building','일반건물',10),
 ('place_type','etc','기타',11),
 ('accessibility','anyone','누구나 이용 가능',1),
 ('accessibility','customer_only','고객만 가능',2),
 ('accessibility','resident_only','숙박객/입주자 전용',3),
 ('accessibility','need_check','확인 필요',4),
 ('restroom_type','male','남자',1),
 ('restroom_type','female','여자',2),
 ('restroom_type','unisex','공용',3),
 ('restroom_type','family','가족',4),
 ('restroom_type','disabled','장애인',5),
 ('bidet_status','normal','정상',1),
 ('bidet_status','weak_pressure','수압 약함',2),
 ('bidet_status','broken','고장',3),
 ('bidet_status','removed','철거됨',4),
 ('bidet_status','need_check','확인 필요',5),
 ('amenities','tissue','휴지 있음',1),
 ('amenities','good_sink','세면대 좋음',2),
 ('amenities','diaper_table','기저귀 교환대',3),
 ('amenities','disabled_access','장애인 이용 가능',4),
 ('amenities','emergency_bell','비상벨',5)
on conflict ("group", code) do nothing;

insert into monetization_settings (key, enabled, config) values
 ('banner_main', false, '{"placement":"map_bottom"}'),
 ('rewarded_register', false, '{"reward":"badge"}')
on conflict (key) do nothing;
