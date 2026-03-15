-- Add new task types for vehicle storage facilities
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'inspection';
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'detailing';
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'cover';
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'climate_check';
