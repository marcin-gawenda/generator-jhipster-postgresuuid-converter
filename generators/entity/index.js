const util = require('util');
const chalk = require('chalk');
const glob = require('glob');
const generator = require('yeoman-generator');
const packagejs = require(`${__dirname}/../../package.json`);
const semver = require('semver');
const BaseGenerator = require('../common');
const jhipsterConstants = require('generator-jhipster/generators/generator-constants');
const _s = require('underscore.string');
const fs = require('fs');

const JhipsterGenerator = generator.extend({});
util.inherits(JhipsterGenerator, BaseGenerator);

module.exports = JhipsterGenerator.extend({
    initializing: {
        readConfig() {
            this.jhipsterAppConfig = this.getAllJhipsterConfig();
            if (!this.jhipsterAppConfig) {
                this.error('Can\'t read .yo-rc.json');
            }
            this.entityConfig = this.options.entityConfig;
        },
        displayLogo() {
            this.log(chalk.white(`Running ${chalk.bold(packagejs.description)} Generator! ${chalk.yellow(`v${packagejs.version}\n`)}`));
        },
        validate() {
            // this shouldn't be run directly
            if (!this.entityConfig) {
                this.env.error(`${chalk.red.bold('ERROR!')} This sub generator should be used only from JHipster and cannot be run directly...\n`);
            }
        }
    },

    prompting() {
        // don't prompt if data are imported from a file
        if (this.entityConfig.useConfigurationFile === true && this.entityConfig.data && typeof this.entityConfig.data.yourOptionKey !== 'undefined') {
            this.yourOptionKey = this.entityConfig.data.yourOptionKey;
            return;
        }
        const done = this.async();
        const prompts = [];

        this.prompt(prompts).then((props) => {
            this.props = props;
            // To access props later use this.props.someOption;

            done();
        });
    },

    writing: {
        updateFiles() {
            // read config from .yo-rc.json
            this.baseName = this.jhipsterAppConfig.baseName;
            this.packageName = this.jhipsterAppConfig.packageName;
            this.packageFolder = this.jhipsterAppConfig.packageFolder;
            this.clientFramework = this.jhipsterAppConfig.clientFramework;
            this.clientPackageManager = this.jhipsterAppConfig.clientPackageManager;
            this.buildTool = this.jhipsterAppConfig.buildTool;

            // use function in generator-base.js from generator-jhipster
            // this.angularAppName = this.getAngularAppName();

            // use constants from generator-constants.js
            const javaDir = `${jhipsterConstants.SERVER_MAIN_SRC_DIR + this.packageFolder}/`;
            const javaTestDir = `${jhipsterConstants.SERVER_TEST_SRC_DIR + this.packageFolder}/`;
            // const resourceDir = jhipsterConstants.SERVER_MAIN_RES_DIR;
            // const webappDir = jhipsterConstants.CLIENT_MAIN_SRC_DIR;

            const entityName = this.entityConfig.entityClass;

            // do your stuff here
            // check if repositories are already annotated
            const uuidGeneratorAnnotation = '@GeneratedValue.*"UUIDGenerator"';
            const pattern = new RegExp(uuidGeneratorAnnotation, 'g');

            const entityJson = this.fs.readJSON(`${process.cwd()}/.jhipster/${entityName}.json`);
            const preserveLongIdRegExp = new RegExp('@puc.preserveLongId', 'g');
            const preserveLongId = preserveLongIdRegExp.test(entityJson.javadoc);

            const content = this.fs.read(`${javaDir}domain/${entityName}.java`, 'utf8');

            this.log(`\n${chalk.bold.green(packagejs.description)} ${chalk.green('updating the entity ')}${chalk.bold.yellow(entityName)}`);

            let f;
            if (!pattern.test(content)) {
                // if (preserveLongIdRegExp.test(entityJson.javadoc)) {
                //     this.log(`${chalk.bold.yellow('Type Long preserved for entity')} ${chalk.bold.yellow(entityName)}`);
                //     return;
                // }
                // We need to convert this entity

                // const preserveFieldsRegExp = /(?:.*?\s)@ch.preserveLongTypesOn (.*)(?:\s|$)/g;
                // const preserveFieldsMatch = preserveFieldsRegExp.exec(entityJson.javadoc);
                //
                // const preserveFields = []; // preserveFieldsMatch[1].split(/,\s/);
                // this.log(`${chalk.yellow('DEBUG')} Type Long will be preserved for fields: ${preserveFields}\n`);
                //
                // const replaceFields = entityJson.fields
                //     .filter(f => f.fieldType === 'Long' && f.fieldName.toLowerCase().indexOf('id') > 0 &&
                //         !preserveFields.some(p => p === f.fieldName));
                // this.log(`${chalk.green('DEBUG')} Type Long will be replaced with UUID for fields: ${replaceFields}\n`);
                //
                // if (replaceFields.length === 0) {
                //     this.log(`${chalk.green('DEBUG')} Nothing to convert for this entity\n`);
                //     return;
                // }

                // replaceFields.forEach(f => {
                //    switch (f) {
                //        case 'id':
                //            break;
                //        default:
                //    }
                // }

                const convertForRelations = [];
                entityJson.relationships.forEach((rel) => {
                    if (rel.otherEntityField === 'id' || rel.relationshipType === 'one-to-many' || rel.relationshipType === 'one-to-one') {
                        const upperOtherEntityName = rel.otherEntityName.charAt(0).toUpperCase() + rel.otherEntityName.slice(1);
                        // this.log(`${chalk.yellow('DEBUG')} upperOtherEntityName: ${upperOtherEntityName}\n`);
                        const otherEntityNameJson = this.fs.readJSON(`${process.cwd()}/.jhipster/${upperOtherEntityName}.json`);
                        // this.log(`${chalk.yellow('DEBUG')} otherEntityNameJson: ${JSON.stringify(otherEntityNameJson,null,'\t')}\n`);
                        // if (!preserveLongIdRegExp.test(otherEntityNameJson.javadoc)) { // returning true for first rel
                        if (!new RegExp('@puc.preserveLongId', 'g').test(otherEntityNameJson.javadoc)) {
                            convertForRelations.push(rel);
                            // this.log(`${chalk.yellow('DEBUG')} convertForRelation: ${JSON.stringify(rel, null, '\t')}\n`);
                        }
                    }
                });

                // JAVA
                // Domain
                if (preserveLongId) {
                    this.log(`${chalk.bold.yellow('Type Long has been preserved for id field')}`);
                } else {
                    this.convertIdField(`${javaDir}domain/${entityName}.java`);
                }

                // DTO
                f = `${javaDir}service/dto/${entityName}DTO.java`;
                if (fs.existsSync(f)) {
                    if (!preserveLongId || convertForRelations.length > 0) {
                        this.importUUID(f, 'import java.util.Objects;');
                    }
                    if (!preserveLongId) {
                        this.convertLongToUUIDForIdField(f);
                    }
                    convertForRelations.forEach((rel) => {
                        this.convertFromTypeToTypeForRelation(f, 'Long', 'UUID', rel.relationshipName, rel.otherEntityName);
                    });
                }

                // Mapper
                f = `${javaDir}service/mapper/${entityName}Mapper.java`;
                if (fs.existsSync(f) && !preserveLongId) {
                    this.importUUID(f, 'import org.mapstruct.*;');
                    this.longToUUID(f);
                }

                // And the Repository
                if (!preserveLongId) {
                    f = `${javaDir}repository/${entityName}Repository.java`;
                    this.importUUID(f, 'import org.springframework.data.jpa.repository.*;');
                    this.convertLongToUUID(f);
                }

                // The Search Repository
                if (fs.existsSync(`${javaDir}repository/search/${entityName}SearchRepository.java`)) {
                    this.importUUID(`${javaDir}repository/search/${entityName}SearchRepository.java`, 'import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;');
                    this.longToUUID(`${javaDir}repository/search/${entityName}SearchRepository.java`);
                }

                // Service
                f = `${javaDir}service/${entityName}Service.java`;
                if (fs.existsSync(f) && !preserveLongId) {
                    this.importUUID(f, 'import java.util.Optional;');
                    this.longToUUID(f);
                }

                // ServiceImp
                f = `${javaDir}service/impl/${entityName}ServiceImpl.java`;
                if (fs.existsSync(f) && !preserveLongId) {
                    this.importUUID(f, 'import java.util.Optional;');
                    this.convertLongToUUID(f);
                }

                // Criteria
                f = `${javaDir}service/dto/${entityName}Criteria.java`;
                if (fs.existsSync(f)) {
                    if (!preserveLongId) {
                        this.convertLongFilterToFilterForIdField(f);
                    }
                    convertForRelations.forEach((rel) => {
                        this.convertFromTypeToTypeForRelation(f, 'LongFilter', 'Filter', rel.relationshipName, rel.otherEntityName);
                    });
                }

                // Resource
                if (!preserveLongId) {
                    f = `${javaDir}web/rest/${entityName}Resource.java`;
                    this.importUUID(f);
                    this.convertLongToUUIDForIdField(f);
                }

                // JavaScript
                const entityNameSpinalCased = _s.dasherize(_s.decapitalize(entityName));
                const stateFile = glob.sync(`${this.webappDir}../webapp/app/entities/${entityNameSpinalCased}/${entityNameSpinalCased}*.state.js`)[0];
                // TODO reimplement
                // this.replaceContent(stateFile, '\{id\:int\}', '{id:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}}', true);

                this.log(`${chalk.red('DEBUG')} Updating entity ${entityName} 3.3 ...\n`);

                // Liquibase
                // f = `src/main/resources/config/liquibase/changelog/entity_${entityName}.xml`;
                const file = glob.sync(`src/main/resources/config/liquibase/changelog/*entity_${entityName}.xml`)[0];
                if (!preserveLongId) {
                    this.replaceContent(file, 'name="id" type="bigint" autoIncrement="\\$\\{autoIncrement\\}"', 'name="id" type="uuid"', true);
                    // this.replaceContent(f, 'autoIncrement="\\$\\{autoIncrement\\}"', '', true);
                }

                convertForRelations.forEach((rel) => {
                    this.convertInLiquibaseForRelation(file, rel.relationshipName);
                });

                // Test
                // ResourceIntTest
                // f = `${javaTestDir}/web/rest/${entityName}ResourceIntTest.java`; // till JH 6.3.1
                f = `${javaTestDir}/web/rest/${entityName}ResourceIT.java`;
                if (!preserveLongId || convertForRelations.length > 0) {
                    this.importUUID(f, 'import java.util.List;');
                }

                if (!preserveLongId) {
                    // Handle the question of life check
                    this.replaceContent(f, '(42L|42)', 'UUID.fromString("00000000-0000-0000-0000-000000000042")', true);
                    this.replaceContent(f, 'setId\\(1L\\)', 'setId(UUID.fromString("00000000-0000-0000-0000-000000000001"))', true);
                    this.replaceContent(f, 'setId\\(2L\\)', 'setId(UUID.fromString("00000000-0000-0000-0000-000000000002"))', true);
                    this.replaceContent(f, 'getId\\(\\)\\.intValue\\(\\)', 'getId().toString()', true);
                    this.replaceContent(f, '\\.intValue\\(\\)', '.toString()', true);
                    this.replaceContent(f, 'Long.MAX_VALUE', 'UUID.randomUUID()', true);
                    // this.replaceContent(f, 'getId\\(\\);', 'getId().toString();', true);
                }

                convertForRelations.forEach((rel) => {
                    this.convertFromTypeToTypeForRelation(f, 'Long', 'UUID', rel.relationshipName, rel.otherEntityName);
                    this.convertShouldNotBeFoundForRelation(f, rel.relationshipName);
                });
            }
        },

        writeFiles() {
            // function to use directly template
            this.template = function (source, destination) {
                fs.copyTpl(this.templatePath(source), this.destinationPath(destination), this);
            };
        },

        updateConfig() {
            this.updateEntityConfig(this.entityConfig.filename, 'yourOptionKey', this.yourOptionKey);
        }
    },

    end() {
        if (this.yourOptionKey) {
            this.log(`\n${chalk.bold.green('postgresuuid-converter enabled')}`);
        }
    }
});
