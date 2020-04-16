UPDATE sqlerpg.TEST
SET NAME = :name, UPDATED_AT = :updated
WHERE ID = :id;
UPDATE sqlerpg.TEST2
SET NAME = :name2, UPDATED_AT = :updated2
WHERE ID = :id2;