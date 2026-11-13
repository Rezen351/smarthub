INSERT INTO printer_settings (id, station, model, paper_width_mm, connection, ip, port, protocol)
VALUES (3, 'PALLET', 'IW-J300H', 80, 'Ethernet', '', 9100, 'RAW TCP')
ON CONFLICT (station) DO NOTHING;
