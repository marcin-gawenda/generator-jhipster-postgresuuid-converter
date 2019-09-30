const _ = require('lodash');
const BaseGenerator = require('generator-jhipster/generators/generator-base');

module.exports = class extends BaseGenerator {

    importUUID(file, importNeedle = 'import java.util.List;') {
        this.replaceContent(file, importNeedle, `${importNeedle}\nimport java.util.UUID;`, false);
    }

    longToUUID(file) {
        this.importUUID(file, 'import java.util.Objects;');
        this.replaceContent(file, 'Long', 'UUID', true);
    }

    convertLongToUUID(file) {
        this.replaceContent(file, 'Long', 'UUID', true);
    }

    convertLongToUUIDForIdField(file) {
        // this.importUUID(file, 'import java.util.Objects;');
        this.replaceContent(file, 'Long id', 'UUID id', true);
        this.replaceContent(file, 'Long getId', 'UUID getId', true);
    }

    convertLongFilterToFilterForIdField(file) {
        this.importUUID(file, 'import java.util.Objects;');
        this.replaceContent(file, 'LongFilter id', 'Filter id', true);
        this.replaceContent(file, 'LongFilter getId', 'Filter getId', true);
    }

    convertIDtoUUIDForColumn(file, importNeedle, columnName) {
        this.replaceContent(file, '@GeneratedValue.*', '@GeneratedValue', true);
        this.replaceContent(file, '.*@SequenceGenerator.*\n', '', true);
        // this.longToUUID(file);
        this.convertLongToUUIDForIdField(file);
    }

    convertIdField(file) {
        this.importUUID(file, '.domain;');
        this.replaceContent(file, '@GeneratedValue.*', '@GeneratedValue', true);
        this.replaceContent(file, '.*@SequenceGenerator.*\n', '', true);
        this.replaceContent(file, 'Long id', 'UUID id', true);
        this.replaceContent(file, 'Long getId', 'UUID getId', true);
    }

    convertFromTypeToTypeForRelation(file, fromType, toType, relationshipName, otherEntityName) {
        this.replaceContent(file, `${fromType} ${relationshipName}Id`, `${toType} ${relationshipName}Id`, true);
        const upperRelationshipName = relationshipName.charAt(0).toUpperCase() + relationshipName.slice(1);
        this.replaceContent(file, `${fromType} get${upperRelationshipName}Id`, `${toType} get${upperRelationshipName}Id`, true);
        this.replaceContent(file, `${fromType} ${otherEntityName}Id`, `${toType} ${otherEntityName}Id`, true);
    }

    convertShouldNotBeFoundForRelation(file, relationshipName) {
        this.replaceContent(file, `${relationshipName}Id \\+ 1`, 'UUID.randomUUID()', true);
    }

    convertInLiquibaseForRelation(file, relationshipName) {
        const snakeRelationshipName = _.snakeCase(relationshipName);
        this.replaceContent(file, `name="${snakeRelationshipName}_id" type="bigint"`, `name="${snakeRelationshipName}_id" type="uuid"`, true);
    }
};

