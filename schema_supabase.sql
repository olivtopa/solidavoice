-- ============================================================================
-- SOLIDAVOICE - SCHEMA SQL COMPLET DE PRODUCTION SUPABASE
-- ============================================================================

-- Extensions nécessaires pour PostGIS (géolocalisation) et UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Enumérations de types
CREATE TYPE user_role AS ENUM ('beneficiary', 'volunteer', 'family_carer', 'admin');
CREATE TYPE help_category AS ENUM ('bricolage', 'courses', 'compagnie', 'ecrivain_public', 'urgence_mineure');
CREATE TYPE request_status AS ENUM ('pending', 'accepted', 'in_progress', 'completed', 'canceled');

-- 1. Table Utilisateurs (Extension de auth.users Supabase)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'beneficiary',
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Profils Spécifiques des Bénéficiaires
CREATE TABLE public.beneficiary_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    address TEXT,
    location GEOGRAPHY(POINT, 4326),
    tts_speed NUMERIC(3,2) DEFAULT 0.85,
    emergency_contact_phone VARCHAR(20),
    trusted_carer_id UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Module 1 : "La Voix du Voisin" (Demandes d'entraide vocale)
CREATE TABLE public.help_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiary_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    audio_raw_url TEXT NOT NULL,
    transcript_text TEXT,
    category help_category DEFAULT 'compagnie',
    urgency_level INT DEFAULT 1,
    location GEOGRAPHY(POINT, 4326),
    status request_status DEFAULT 'pending',
    assigned_volunteer_id UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Module 2 : "Le Fil d'À Côté" (Gazette Audio)
CREATE TABLE public.gazette_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    audio_url TEXT NOT NULL,
    duration_seconds INT NOT NULL DEFAULT 30,
    is_approved BOOLEAN DEFAULT FALSE,
    moderation_notes TEXT,
    target_zipcode VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Module 3 : "Décodeur Facile" (Documents OCR + FALC)
CREATE TABLE public.document_decodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiary_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    raw_ocr_text TEXT,
    falc_title VARCHAR(150),
    falc_sender VARCHAR(100),
    falc_summary TEXT,
    falc_action_required TEXT,
    due_date DATE,
    amount_due NUMERIC(10,2),
    escalated_to_volunteer BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Module Notifications : Préférences WhatsApp & SMS pour les Bénévoles
CREATE TABLE public.volunteer_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    receive_whatsapp BOOLEAN DEFAULT TRUE,
    receive_sms BOOLEAN DEFAULT TRUE,
    notification_radius_km INT DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Historique des notifications envoyées (Logs WhatsApp / Twilio SMS)
CREATE TABLE public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_phone VARCHAR(20) NOT NULL,
    channel VARCHAR(20) CHECK (channel IN ('whatsapp', 'twilio_sms', 'push')),
    message_body TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Active le Row Level Security (RLS) sur toutes les tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiary_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gazette_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_decodes ENABLE ROW LEVEL SECURITY;

-- Stratégies RLS de lecture / écriture
CREATE POLICY "Utilisateurs lisent leur propre profil" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Public lit les demandes d'entraide actives" ON public.help_requests FOR SELECT USING (true);
CREATE POLICY "Bénéficiaires créent des demandes" ON public.help_requests FOR INSERT WITH CHECK (auth.uid() = beneficiary_id);
CREATE POLICY "Public lit la gazette modérée" ON public.gazette_messages FOR SELECT USING (is_approved = true);
