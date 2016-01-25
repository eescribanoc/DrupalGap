/*! drupalgap 2016-01-24 */
// Initialize the DrupalGap JSON object and run the bootstrap.
var dg = {}; var drupalgap = dg;

dg.activeTheme = null;
dg.regions = null; // Holds instances of regions.
dg.blocks = null; // Holds instances of blocks.
dg.spinner = 0; // Holds onto how many spinners have been thrown up.

// Configuration setting defaults.
dg.settings = {
  mode: 'web-app',
  front: null,
  blocks: {}
};

// Start.
dg.start = function() {
  if (dg.getMode() == 'phonegap') {
    document.addEventListener('deviceready', dg.deviceready, false);
  }
  else { dg.deviceready(); } // web-app
};

// Device ready.
dg.deviceready = function() {
  dg.bootstrap();
  if (!jDrupal.isReady()) {
    dg.alert('Set the sitePath in the settings.js file!');
    return;
  }
  //jDrupal.moduleInvokeAll('deviceready');
  jDrupal.connect().then(this.devicereadyGood, this.devicereadyBad);
};
dg.devicereadyGood = function(data) {
  // Pull out any important data from the Connect resource results.
  for (var d in data.drupalgap) {
    if (!data.drupalgap.hasOwnProperty(d)) { continue; }
    drupalgap[d] = data.drupalgap[d];
  }
  // Force a check on the router (which is already listening at this point), to
  // refresh the current page or navigate to the current path.
  dg.router.check(dg.router.getFragment());
};
dg.devicereadyBad = function() {
  var note = 'Failed connection to ' + jDrupal.sitePath();
  if (msg != '') { note += ' - ' + msg; }
  dg.alert(note, {
    title: 'Unable to Connect',
    alertCallback: function() { }
  });
};

// Bootstrap.
dg.bootstrap = function() {

  dg.router.config({
    //mode: 'history',
    //root: 'discasaurus.com'
  });

  // Build the routes.
  // @TODO turn route building into promises.
  // @TODO turn the outer portion of this procedure into a re-usable function
  // that can iterate over modules and call a specific function within that
  // module.
  var modules = jDrupal.modulesLoad();
  for (var module in modules) {
    if (!modules.hasOwnProperty(module) || !modules[module].routing) { continue; }
    var routes = modules[module].routing();
    if (!routes) { continue; }
    for (route in routes) {
      if (!routes.hasOwnProperty(route)) { continue; }
      var item = routes[route];
      dg.router.add(item);
    }
  }

  // Load the theme.
  dg.themeLoad().then(function() {

    //dg.blocksLoad().then(function(blocks) {

      var blocks = dg.blocksLoad();

      // Add a default route, and start listening.
      dg.router.add(function() { }).listen();

    //});



  });

};

dg.spinnerShow = function() {
  dg.spinner++;
  if (dg.spinner == 1) { document.getElementById('dgSpinner').style.display = 'block'; }
};
dg.spinnerHide = function() {
  dg.spinner--;
  if (!dg.spinner) { document.getElementById('dgSpinner').style.display = 'none'; }
};
// We prefixed this file name with an underscore so that dg.FormElement is available quickly. This is our cheap fix
// until we figure out a better Gruntfile to handle this.

// @see https://api.drupal.org/api/drupal/core!lib!Drupal!Core!Render!Element!FormElementInterface.php/interface/FormElementInterface/8

/**
 * The Form Element prototype.
 * @param {String} name
 * @param {Object} element
 * @param {Object} form
 * @constructor
 */
dg.FormElement = function(name, element, form) {
  this.name = name;
  this.element = element; // Holds the form element JSON object provided by the form builder.
  this.form = form;
};
dg.FormElement.prototype.id = function() { return this.element ? this.element._attributes.id : null; };
dg.FormElement.prototype.getForm = function() { return this.form; };
dg.FormElement.prototype.get = function(property) {
  return typeof this[property] ? this[property] : null;
};

dg.FormElement.prototype.valueCallback = function() {
  var self = this;
  return new Promise(function(ok, err) {
    var value = null;
    var el = document.getElementById(self.id());
    if (el) { value = el.value; }
    ok({
      name: self.get('name'),
      value: value
    });
  });
};

/**
 * Theme's a form element label.
 * @param variables
 * @returns {string}
 * @see https://api.drupal.org/api/drupal/core!modules!system!templates!form-element-label.html.twig/8
 */
dg.theme_form_element_label = function(variables) {
  return '<label ' + dg.attributes(variables._attributes) + '>' + variables._title + '</label>';
};

// @see https://api.drupal.org/api/drupal/core!modules!block!src!Entity!Block.php/class/Block/8

// @see https://www.drupal.org/node/2101565

// @TODO change block properties to use an underscore prefix.

/**
 * The BLock prototype.
 * @constructor
 */
dg.Block = function(config) {
  this.format = 'div';
  for (var setting in config) {
    if (!config.hasOwnProperty(setting)) { continue; }
    this[setting] = config[setting];
  }
};

dg.Block.prototype.get = function(property) {
  return typeof this[property] !== 'undefined' ? this[property] : null;
};
dg.Block.prototype.set = function(property, value) {
  this[property] = value;
};
dg.Block.prototype.buildWrapper = function() {
  var self = this;
  return new Promise(function(ok, err) {
    self.build().then(function(content) {
      self.set('content', content);
      ok(self);
    });
  });
};
dg.Block.prototype.build = function() {
  // abstract
  return new Promise(function(ok, err) { ok(''); });
};
dg.Block.prototype.getVisibility = function() {
  var self = this;
  var account = dg.currentUser();
  return new Promise(function(ok, err) {
    var visible = true;
    if (self.roles) {
      for (var i = 0; i < self.roles.length; i++) {
        if (account.hasRole(self.roles[i].target_id)) {
          visible = self.roles[i].visible;
        }
        else {
          visible = !self.roles[i].visible;
        }
        if (!visible) { break; }
      }
    }
    ok({
      visible: visible,
      block: self
    });
  });
};

dg.blocksLoad = function() {
  //return new Promise(function(ok, err) {
    if (!dg.blocks) {

      dg.blocks = {};

      // First, figure out what blocks are defined in the settings.js file and
      // set them aside. Warn the developer if there are no blocks defined.
      var appBlocks = {};
      var themeName = dg.config('theme').name;
      var blockSettings = drupalgap.settings.blocks[themeName];
      var blockCount = 0;
      // Iterate over each region mentioned in the theme settings...
      for (var region in blockSettings) {
        if (!blockSettings.hasOwnProperty(region)) { continue; }
        // Iterate over each block mentioned in the theme's region settings...
        for (var themeBlock in blockSettings[region]) {
          if (!blockSettings[region].hasOwnProperty(themeBlock)) { continue; }
          var block = blockSettings[region][themeBlock];
          block.region = region;
          appBlocks[themeBlock] = block;
          blockCount++;
        }
      }
      if (blockCount == 0) {
        var msg = 'WARNING: No blocks were found for the "' + themeName + '" theme in settings.js';
        console.log(msg);
      }

      //console.log('loaded the blocks from settings.js');
      //console.log(appBlocks);

      // Gather all the blocks defined by modules, and then instantiate only
      // the blocks defined by the app.

      // For each module that overwrites the "blocks" function on their prototype...
      var modules = jDrupal.modulesLoad();
      for (var module in modules) {

        // Skip modules without blocks.
        if (!modules.hasOwnProperty(module) || !modules[module].blocks) { continue; }
        var blocks = modules[module].blocks();
        if (!blocks) { continue; }

        // For each block provided by the module (skipping any blocks not
        // mentioned by the app)...
        for (block in blocks) {
          if (!blocks.hasOwnProperty(block) || !appBlocks[block]) { continue; }

          // Extract the block's config from the module and set any defaults.
          var config = blocks[block];
          if (!config.id) { config.id = block; }
          if (!config.module) { config.module = module; }
          if (!config.attributes) { config.attributes = {}; }
          if (!config.attributes.id) { config.attributes.id = dg.cleanCssIdentifier(block); }

          // Create an instance of the block, warn if someone overwrites somebody
          // else's block.
          if (dg.blocks[block]) {
            var msg = 'WARNING - The "' + block + '" block provided by the "' + dg.blocks[block].get('module') + '" ' +
              'module has been overwritten by the "' + config.module + '" module.';
            console.log(msg);
          }
          dg.blocks[block] = new dg.Block(config);

          // Merge the block config from settings.js into the block instance.
          // @TODO turn this into dg.extend().
          for (var setting in appBlocks[block]) {
            if (!appBlocks[block].hasOwnProperty(setting)) { continue; }
            dg.blocks[block].set(setting, appBlocks[block][setting]);
          }
        }
      }

      //console.log('blocks have been loaded');
      //console.log(dg.blocks);

      //ok(dg.blocks);
      return dg.blocks;
    }
    else {
      //ok(dg.blocks);
      return dg.blocks;
    }
  //});
};

dg.blockLoad = function(id) {
  return dg.blocks[id] ? dg.blocks[id] : null;
};
/**
 * Get or set a drupalgap configuration setting.
 * @param name
 * @returns {*}
 */
dg.config = function(name) {
  var value = typeof arguments[1] !== 'undefined' ? arguments[1] : null;
  if (value) {
    dg.settings[name] = value;
    return;
  }
  return dg.settings[name];
};

// Mode.

/**
 *
 * @returns {*}
 */
dg.getMode = function() { return this.config('mode'); };

/**
 *
 * @param mode
 */
dg.setMode = function(mode) { this.config('mode', mode); };

/**
 *
 * @returns {*}
 */
dg.getFrontPagePath = function() {
  var front = dg.config('front');
  if (front == null) { front = 'dg'; }
  return front;
};

/**
 * Gets the current page title.
 * @returns {*}
 */
dg.getTitle = function() { return this._title; };

/**
 * Sets the current page title.
 * @param title
 */
dg.setTitle = function(title) { this._title = title; };

/**
 *
 * @param attributes
 * @returns {string}
 */
dg.attributes = function(attributes) {
  var attrs = '';
  if (attributes) {
    for (var name in attributes) {
      if (!attributes.hasOwnProperty(name)) { continue; }
      var value = attributes[name];
      if (Array.isArray(value) && value.length) {
        attrs += name + '="' + value.join(' ') + '" ';
      }
      else if (value != '') {
        // @todo - if someone passes in a value with double quotes, this
        // will break. e.g.
        // 'onclick':'_drupalgap_form_submit("' + form.id + "');'
        // will break, but
        // 'onclick':'_drupalgap_form_submit(\'' + form.id + '\');'
        // will work.
        attrs += name + '="' + value + '" ';
      }
      else {
        // The value was empty, just place the attribute name on the
        // element, unless it was an empty class.
        if (name != 'class') { attrs += name + ' '; }
      }
    }
  }
  return attrs;
};

/**
 *
 * @param constructor
 * @param argArray
 * @returns {*}
 * @credit http://stackoverflow.com/a/14378462/763010
 */
dg.applyToConstructor = function(constructor, argArray) {
  var args = [null].concat(argArray);
  var factoryFunction = constructor.bind.apply(constructor, args);
  return new factoryFunction();
};

/**
 *
 * @param id
 * @returns {string}
 */
dg.cleanCssIdentifier = function(id) {
  return id.replace(/_/g, '-').toLowerCase();
};

/**
 * Given a string separated by underscores or hyphens, this will return the
 * camel case version of a string. For example, given "foo_bar" or "foo-bar",
 * this will return "fooBar".
 * @see http://stackoverflow.com/a/2970667/763010
 */
dg.getCamelCase = function(str) {
  return str.replace(/[-_]([a-z])/g, function (g) { return g[1].toUpperCase(); });
};

/**
 *
 * @param str
 * @param separator
 * @returns {string}
 */
dg.killCamelCase = function(str, separator) {
  return jDrupal.lcfirst(str).replace(/([A-Z])/g, separator + '$1').toLowerCase();
};

/**
 * Given a drupal image file uri, this will return the path to the image on the Drupal site.
 * @param uri
 * @returns {*}
 */
dg.imagePath = function(uri) {
  var src = dg.restPath() + uri;
  if (src.indexOf('public://') != -1) {
    src = src.replace('public://', dg.config('files').publicPath + '/');
  }
  else if (src.indexOf('private://') != -1) {
    src = src.replace('private://', dg.config('files').privatePath + '/');
  }
  return src;
};

/**
 * Returns html for a simple link.
 * @param text
 * @param path
 * @param options
 * @returns {String}
 */
dg.l = function(text, path, options) {
  if (!options) { options = {}; }
  if (!options._text) { options._text = text; }
  if (!options._path) { options._path = path; }
  return dg.theme('link', options);
};

/**
 * Returns html for a button link.
 * @param text
 * @param path
 * @param options
 * @returns {String}
 */
dg.bl = function(text, path, options) { return this.l.apply(this, arguments); };

/**
 * Given an id, this will remove its element from the DOM.
 * @param id
 */
dg.removeElement = function(id) {
  var elem = document.getElementById(id);
  elem.parentElement.removeChild(elem);
};

/**
 *
 * @param text
 * @returns {*}
 */
dg.t = function(text) { return text; };

/**
 * A proxy to create an instance of a jDrupal Node object.
 * @param nid_or_node
 * @returns {jDrupal.Node}
 * @constructor
 */
dg.Node = function(nid_or_node) { return new jDrupal.Node(nid_or_node); };

dg.entityRenderContent = function(entity) {

  return new Promise(function(ok, err) {

    var entityType = entity.getEntityType();
    var bundle = entity.getBundle();
    var label = entity.getEntityKey('label');

    // Build the render array for the entity...
    var content = {};

    // Add the entity label.
    dg.setTitle({
      _theme: 'entity_label',
      _entity: entity,
      _attributes: {
        'class': [entityType + '-title']
      }
    });

    //console.log(dg);
    //console.log(dg.entity_view_mode);

    // Get the view mode.
    // @TODO viewMode should be turned into a prototype. Then use its functions below instead of accessing properties directly.
    var viewMode = bundle ? dg.entity_view_mode[entityType][bundle] : dg.entity_view_mode[entityType];
    //console.log('viewMode - ' + entityType + ' / ' + bundle);
    //console.log(viewMode);

    // Iterate over each field in the drupalgap entity view mode.
    for (var fieldName in viewMode) {
      if (!viewMode.hasOwnProperty(fieldName)) { continue; }

      //console.log(fieldName);
      //console.log(viewMode[fieldName]);

      // Grab the field storage config and the module in charge of the field.
      var fieldStorageConfig = dg.fieldStorageConfig[entityType][fieldName];
      if (!fieldStorageConfig) {
        console.log('WARNING - entityRenderContent - No field storage config for "' + fieldName + '"');
      }
      else {

        var module = fieldStorageConfig.module;
        var type = viewMode[fieldName].type;
        //console.log(module);
        //console.log(fieldStorageConfig);

        if (!jDrupal.moduleExists(module)) {
          var msg = 'WARNING - entityRenderContent - The "' + module + '" module is not present to render the "' + fieldName + '" field.';
          console.log(msg);
          continue;
        }
        if (!dg.modules[module].FieldFormatter || !dg.modules[module].FieldFormatter[type]) {
          console.log('WARNING - entityRenderContent - There is no "' + type + '" formatter in the "' + module + '" module to handle the "' + fieldName + '" field.');
          continue;
        }

        var FieldItemListInterface = new dg.FieldItemListInterface(entity.get(fieldName));
        var FieldDefinitionInterface = new dg.FieldDefinitionInterface(entityType, bundle, fieldName); // @TODO reinstantiating this is stupid. they should be globally instantiated once
        var FieldFormatter = new dg.modules[module].FieldFormatter[type](
            FieldDefinitionInterface,
            viewMode[fieldName].settings, // settings
            viewMode[fieldName].label, // label
            viewMode[fieldName], // viewMode
            viewMode[fieldName].third_party_settings // thirdPartySettings
        );
        var elements = FieldFormatter.viewElements(FieldItemListInterface, entity.language());
        if (jDrupal.isEmpty(elements)) { continue; }
        var children = {
          label: {
            _theme: 'form_element_label',
            _title: FieldDefinitionInterface.getLabel(),
            _title_display: 'before'
          },
          elements: elements
        };
        content[fieldName] = {
          _theme: 'container',
          _children: children,
          _attributes: {
            'class': [fieldName.replace(/_/g,'-')]
          },
          _weight: viewMode[fieldName].weight
        };

      }

    }
    jDrupal.moduleInvokeAll('entity_view', content, entity).then(ok(content));

  });

};

dg.theme_entity_label = function(variables) {
  return '<h1 ' + dg.attributes(variables._attributes) + '>' + dg.t(variables._entity.label()) + '</h1>';
};
dg.FieldDefinitionInterface = function(entityType, bundle, fieldName) {
  this.entityType = entityType;
  this.bundle = bundle;
  this.fieldName = fieldName;
  this.fieldDefinition = dg.fieldDefinitions[entityType][bundle][fieldName];
};
dg.FieldDefinitionInterface.prototype.get = function(prop) {
  return typeof this.fieldDefinition[prop] ? this.fieldDefinition[prop] : null;
};
dg.FieldDefinitionInterface.prototype.getLabel = function() {
  return this.get('label');
};
dg.FieldFormMode = function(fieldFormMode) {
  this.fieldFormMode = fieldFormMode;
};
dg.FieldFormMode.prototype.getWeight = function() {
  return this.fieldFormMode.weight;
};

// @see https://api.drupal.org/api/drupal/core!lib!Drupal!Core!Field!FormatterBase.php/class/FormatterBase/8
// @see https://api.drupal.org/api/drupal/core!lib!Drupal!Core!Field!Annotation!FieldFormatter.php/class/FieldFormatter/8

dg.FieldFormatter = function() {
  this._fieldDefinition = null;
  this._settings = null;
  this._label = null;
  this._viewMode = null;
  this._thirdPartySettings = null;
};

/**
 * Used to prepare a field formatter default constructor.
 * @param FieldFormatter
 * @param args
 * @constructor
 */
dg.FieldFormatterPrepare = function(FieldFormatter, args) {
  this._fieldDefinition = args[0];
  this._settings = args[1];
  this._label = args[2];
  this._viewMode = args[3];
  this._thirdPartySettings = args[4];
};

// Builds a renderable array for a field value.
dg.FieldFormatter.prototype.viewElements = function(FieldItemListInterface, langcode) {
  var items = FieldItemListInterface.getItems();
  var element = {};
  if (items.length == 0) { return element; }
  for (var delta = 0; delta < items.length; delta++) {
    element[delta] = { _markup: items[delta].value };
  }
  return element;
};

// @see https://api.drupal.org/api/drupal/core!lib!Drupal!Core!Field!FieldItemListInterface.php/interface/FieldItemListInterface/8

dg.FieldItemListInterface = function(items) {
  this._items = items;
};

dg.FieldItemListInterface.prototype.getItems = function() { return this._items; };

// @see https://api.drupal.org/api/drupal/core!modules!field!field.api.php/group/field_widget/8
// @see http://capgemini.github.io/drupal/writing-custom-fields-in-drupal-8/
dg.FieldWidget = function(entityType, bundle, fieldName, element, items, delta) {
  // Any default constructor behavior lives in FieldWidgetPrepare
};
// Extend the FormElement prototype.
dg.FieldWidget.prototype = new dg.FormElement;
dg.FieldWidget.prototype.constructor = dg.FieldWidget;
/**
 * Used to prepare a Field Widget default constructor.
 * @param FieldWidget
 * @param args
 * @constructor
 */
dg.FieldWidgetPrepare = function(FieldWidget, args) {
  FieldWidget.widgetType = 'FieldWidget';
  FieldWidget.entityType = args[0];
  FieldWidget.bundle = args[1];
  FieldWidget.fieldName = args[2];
  FieldWidget.name = FieldWidget.fieldName;
  FieldWidget.element = args[3];
  FieldWidget.items = args[4];
  FieldWidget.delta = args[5];
  FieldWidget.fieldDefinition = new dg.FieldDefinitionInterface(
      FieldWidget.entityType,
      FieldWidget.bundle,
      FieldWidget.fieldName
  );
  FieldWidget.fieldFormMode = FieldWidget.element._fieldFormMode;
};
dg.FieldWidget.prototype.getSetting = function(prop) {
  return typeof this.settings[prop] ? this.settings[prop] : null;
};
dg.FieldWidget.prototype.setSetting = function(prop, val) {
  this.settings[property] = val;
};
dg.FieldWidget.prototype.getSettings = function() {
  return this.settings;
};
dg.FieldWidget.prototype.setSettings = function(val) {
  this.settings = val;
};

dg.FieldWidget.prototype.valueCallback = function() {
  var self = this;
  return new Promise(function(ok, err) {
    var value = null;
    var el = document.getElementById(self.id());
    if (el) { value = el.value; }
    ok({
      name: self.get('name'),
      value: [ { value: value }  ]
    });
  });
};

dg.theme_actions = function(variables) {
  var html = '';
  for (prop in variables) {
    if (!dg.isFormElement(prop, variables)) { continue; }
    html += dg.render(variables[prop]);
  }
  return html;
};
dg.theme_hidden = function(variables) {
  variables._attributes.type = 'hidden';
  return '<input ' + dg.attributes(variables._attributes) + ' />';
};
dg.theme_number = function(variables) {
  variables._attributes.type = 'number';
  return '<input ' + dg.attributes(variables._attributes) + '/>';
};
dg.theme_password = function(variables) {
  variables._attributes.type = 'password';
  return '<input ' + dg.attributes(variables._attributes) + ' />';
};
dg.theme_submit = function(variables) {
  variables._attributes.type = 'submit';
  var value = 'Submit';
  if (!variables._attributes.value && variables._value) {
    variables._attributes.value = variables._value;
  }
  return '<input ' + dg.attributes(variables._attributes) + '/>';
};
dg.theme_textarea = function(variables) {
  var value = variables._value ? variables._value : '';
  return '<textarea ' + dg.attributes(variables._attributes) + '>' + value + '</textarea>';
};
dg.theme_textfield = function(variables) {
  variables._attributes.type = 'text';
  return '<input ' + dg.attributes(variables._attributes) + '/>';
};
// @see https://api.drupal.org/api/drupal/core!lib!Drupal!Core!Form!FormStateInterface.php/interface/FormStateInterface/8

/**
 *
 * @constructor
 */
dg.FormStateInterface = function(form) {
  this.form = form;
  this.values = {};
  this.errors = {};
};

dg.FormStateInterface.prototype.get = function(property) {
  return typeof this[property] !== 'undefined' ? this[property] : null;
};
dg.FormStateInterface.prototype.set = function(property, value) {
  this[property] = value;
};
dg.FormStateInterface.prototype.setFormState = function() {
  var self = this;
  var form = self.get('form');
  var promises = [];
  for (var name in form.elements) {
    if (name == 'actions') { continue; }
    promises.push(form.elements[name].valueCallback());
  }
  return Promise.all(promises).then(function(values) {
    for (var i = 0; i < values.length; i++) {
      self.setValue(values[i].name, values[i].value);
    }
  });
};
dg.FormStateInterface.prototype.setErrorByName = function(name, msg) {
  this.errors[name] = msg;
};
dg.FormStateInterface.prototype.getErrors = function() {
  return this.errors;
};
dg.FormStateInterface.prototype.hasAnyErrors = function() {
  var hasError = false;
  var errors = this.getErrors();
  for (error in errors) {
    if (!errors.hasOwnProperty(error)) { continue; }
    hasError = true;
    break;
  }
  return hasError;
};
dg.FormStateInterface.prototype.getErrorMessages = function() {
  var msg = '';
  var errors = this.getErrors();
  for (error in errors) {
    if (!errors.hasOwnProperty(error)) { continue; }
    msg += error + ' - ' + errors[error];
  }
  return msg;
};
dg.FormStateInterface.prototype.displayErrors = function() {
  dg.alert(this.getErrorMessages());
};
dg.FormStateInterface.prototype.getValue = function(key, default_value) {
  return typeof this.get('values')[key] !== 'undefined' ?
    this.get('values')[key] : default_value;
};
dg.FormStateInterface.prototype.setValue = function(key, value) {
  this.values[key] = value;
};
dg.FormStateInterface.prototype.getValues = function() {
  return this.get('values');
};
dg.FormStateInterface.prototype.setValues = function(values) {
  this.values = values;
};
dg.FormWidget = function(entityType, bundle, fieldName, element, items, delta) {
  // Any default constructor behavior lives in FormWidgetPrepare
};
// Extend the FormElement prototype.
dg.FormWidget.prototype = new dg.FormElement;
dg.FormWidget.prototype.constructor = dg.FormWidget;

/**
 * Used to prepare a Form Widget default constructor.
 * @param FormWidget
 * @param args
 * @constructor
 */
dg.FormWidgetPrepare = function(FormWidget, args) {
  FormWidget.widgetType = 'FormWidget';
  FormWidget.entityType = args[0];
  FormWidget.bundle = args[1];
  FormWidget.fieldName = args[2];
  FormWidget.name = FormWidget.fieldName;
  FormWidget.element = args[3];
  FormWidget.items = args[4];
  FormWidget.delta = args[5];
  FormWidget.fieldFormMode = FormWidget.element._fieldFormMode;
};

dg.FormWidget.prototype.valueCallback = function() {
  var self = this;
  return new Promise(function(ok, err) {
    var value = null;
    var el = document.getElementById(self.id());
    if (el) { value = el.value; }
    ok({
      name: self.get('name'),
      value: [ { value: value }  ]
    });
  });
};

dg.forms = {}; // A global storage for active forms.

/**
 * The Form prototype.
 * @param id
 * @constructor
 */
dg.Form = function(id) {

  this.id = id;
  this.form = {
    _attributes: {
      id: dg.killCamelCase(id, '-').toLowerCase()
    },
    _validate: [id + '.validateForm'],
    _submit: [id + '.submitForm']
  };
  this.form_state = new dg.FormStateInterface(this);
  this.elements = {}; // Holds FormElement instances.

};

dg.Form.prototype.getFormId = function() { return this.id; };

dg.Form.prototype.getForm = function() {
  var self = this;
  return new Promise(function(ok, err) {
    self.buildForm(self.form, self.form_state).then(function() {

      // Set up default values across each element.
      for (name in self.form) {
        if (!dg.isFormElement(name, self.form)) { continue; }
        var el = self.form[name];
        if (el._type == 'actions') {
          dg.setFormElementDefaults(name, el);
          for (_name in el) {
            if (!dg.isFormElement(_name, el)) { continue; }
            dg.setFormElementDefaults(_name, el[_name]);
          }
        }
        else { dg.setFormElementDefaults(name, el); }
      }

      // Allow form alterations, and set up the resolve to instantiate the form
      // elements and resolve the rendered form.
      // @TODO should this alter be moved after the widget assembly? Then we won't have to pass the element by reference
      // to its widget form builder.
      var alters = jDrupal.moduleInvokeAll('form_alter', self.form, self.getFormState(), self.getFormId());
      var render = function() {
        for (var name in self.form) {
          if (!dg.isFormElement(name, self.form)) { continue; }
          var element = self.form[name];
          switch (element._widgetType) {
            case 'FieldWidget':
            case 'FormWidget':
                // Instantiate the widget using the element's module, then build the element form and then add it to the
                // form as a container.
                var items = self.form._entity.get(name);
                var delta = 0;
                var widget = new dg.modules[element._module][element._widgetType][element._type](
                  self.form._entityType,
                  self.form._bundle,
                  name,
                  element,
                  items,
                  delta
                );
                self.elements[name] = widget;
                widget.form(items, delta, element, self.form, self.form_state);
                // Wrap elements in containers, except for hidden elements.
                if (element._type == 'hidden') { self.form[name] = element; }
                else {
                  var children = {};
                  if (element._title) {
                    children.label = {
                      _theme: 'form_element_label',
                      _title: element._title
                    }
                  }
                  children.element = element;
                  var container = {
                    _theme: 'container',
                    _children: children,
                    _weight: element._weight
                  };
                  self.form[name] = container;
                }
              break;
            case 'FormElement':
            default:
                // Instantiate a new form element.
                self.elements[name] = new dg[element._widgetType](name, element, self);
              break;
          }
        }
        ok('<form ' + dg.attributes(self.form._attributes) + '>' + dg.render(self.form) + '</form>');
      };
      if (!alters) { render(); }
      else { alters.then(render); }

    });
  });
};

dg.Form.prototype.getFormState = function() {
  return this.form_state;
};

dg.Form.prototype.buildForm = function(form, form_state, options) {
  // abstract
  return new Promise(function(ok, err) {
    ok();
  });
};
dg.Form.prototype.validateForm = function(options) {
  // abstract
  return new Promise(function(ok, err) {
    ok();
  });
};
dg.Form.prototype.submitForm = function(form, form_state, options) {
  // abstract
  return new Promise(function(ok, err) {
    ok();
  });
};

// dg core form UX submission handler
dg.Form.prototype._submission = function() {
  var self = this;
  return new Promise(function(ok, err) {
    var formState = self.getFormState();
    formState.setFormState().then(function() {
      self._validateForm().then(function() {
        if (formState.hasAnyErrors()) {
          formState.displayErrors();
          err();
          return;
        }
        self._submitForm(self, formState).then(function() {
          if (self.form._action) { dg.goto(self.form._action); }
          dg.removeForm(self.getFormId());
          ok();
        });
      });
    });
  });
};

// dg core form validation handler
dg.Form.prototype._validateForm = function() {
  var self = this;
  var promises = [];
  for (var i = 0; i < self.form._validate.length; i++) {
    var parts = self.form._validate[i].split('.');
    var obj = parts[0];
    var method = parts[1];
    // Handle prototype validation handler, if any.
    if (obj == this.getFormId() && method == 'validateForm') {
      promises.push(this[method].apply(self, [self.form, self.getFormState()]));
      continue;
    }
    // Handle external validation handlers, if any.
    if (!window[obj] || !window[obj][method]) { continue; }
    promises.push(window[obj][method].apply(self, [self.form, self.getFormState()]));
  }
  return Promise.all(promises);
};

// dg core form submit handler
dg.Form.prototype._submitForm = function() {
  var self = this;
  var promises = [];
  for (var i = 0; i < self.form._submit.length; i++) {
    var parts = self.form._submit[i].split('.');
    var obj = parts[0];
    var method = parts[1];
    // Handle prototype submission handler, if any.
    if (obj == this.getFormId() && method == 'submitForm') {
      promises.push(this[method].apply(self, [self.form, self.getFormState()]));
      continue;
    }
    // Handle external submission handlers, if any.
    if (!window[obj] || !window[obj][method]) { continue; }
    promises.push(window[obj][method].apply(self, [self.form, self.getFormState()]));
  }
  return Promise.all(promises);
};

dg.addForm = function(id, form) {
  this.forms[id] = form;
  return this.forms[id];
};
dg.loadForm = function(id) {
  return this.forms[id] ? this.forms[id] : null;
};
dg.loadForms = function() { return this.forms; };
dg.removeForm = function(id) { delete this.forms[id]; };
dg.removeForms = function() { this.forms = {}; };

dg.isFormElement = function(prop, obj) {
  return obj.hasOwnProperty(prop) && prop.charAt(0) != '_';
};
dg.isFormProperty = function(prop, obj) {
  return obj.hasOwnProperty(prop) && prop.charAt(0) == '_';
};
dg.setFormElementDefaults = function(name, el) {
  var attrs = el._attributes ? el._attributes : {};
  if (!attrs.id) { attrs.id = 'edit-' + name.toLowerCase().replace(/_/g, '-'); }
  if (!attrs.name) { attrs.name = name; }
  if (!attrs.class) { attrs.class = []; }
  if (!attrs.value && el._value) { attrs.value = el._value; }
  if (!el._widgetType) { el._widgetType = 'FormElement'; }
  if (el._title_placeholder) { attrs.placeholder = el._title; }
  el._attributes = attrs;
};
dg.goto = function(path) {
  this.router.navigate(path);
  //this.router.check('/' + path);
};
/**
 * Alerts a message to the user using PhoneGap's alert. It is important to
 * understand this is an async function, so code will continue to execute while
 * the alert is displayed to the user.
 * You may optionally pass in a second argument as a JSON object with the
 * following properties:
 *   alertCallback - the function to call after the user presses OK
 *   title - the title to use on the alert box, defaults to 'Alert'
 *   buttonName - the text to place on the button, default to 'OK'
 * @param {String} message
 */
dg.alert = function(message) {
  var options = null;
  if (arguments[1]) { options = arguments[1]; }
  var alertCallback = function() { };
  var title = 'Alert';
  var buttonName = 'OK';
  if (options) {
    if (options.alertCallback) { alertCallback = options.alertCallback; }
    if (options.title) { title = options.title; }
    if (options.buttonName) { buttonName = options.buttonName; }
  }
  if (
    dg.config('mode') != 'phonegap' ||
    typeof navigator.notification === 'undefined'
  ) { alert(message); alertCallback(); }
  else {
    navigator.notification.alert(message, alertCallback, title, buttonName);
  }
};
dg.modules = jDrupal.modules;

dg.Module = function() { };

// Extend the jDrupal Module prototype.
dg.Module.prototype = new jDrupal.Module;
dg.Module.prototype.constructor = dg.Module;


dg.Module.prototype.routing = function() {
  return null;
};

//dg.Module.prototype.blocks = function() {
//  return null;
//};
// @TODO change region properties to use an underscore prefix.
// This will allow us to easily separate properties from blocks within settings.js

/**
 * The Form Element prototype.
 * @constructor
 */
dg.Region = function(config) {
  this.format = 'div';
  for (var setting in config) {
    if (!config.hasOwnProperty(setting)) { continue; }
    this[setting] = config[setting];
  }
};

dg.Region.prototype.get = function(property) {
  return typeof this[property] !== 'undefined' ? this[property] : null;
};
dg.Region.prototype.set = function(property, value) {
  this[property] = value;
};

dg.loadRegions = function() {

};

dg.Region.prototype.getBlocks = function() {
  var blocks = dg.blocksLoad();
  var result = [];
  for (var block in blocks) {
    if (!blocks.hasOwnProperty(block)) { continue; }
    if (blocks[block].get('region') == this.get('id')) {
      result.push(block);
    }
  }
  return result;
};

// @see https://www.drupal.org/developing/api/8/render/arrays

dg._postRender = []; // Holds onto postRenders for the current page's render array(s).

/**
 *
 * @param content
 * @see https://api.drupal.org/api/drupal/core!includes!common.inc/function/render/8
 */
dg.appRender = function(content) {
  dg.themeLoad().then(function(theme) {
    var innerHTML = '';

    // Process regions.
    // @TODO move this to dg.loadRegions().
    dg.regions = {};
    var regions = theme.getRegions();
    for (var id in regions) {
      if (!regions.hasOwnProperty(id)) { continue; }

      // Instantiate the region, merge the theme's configuration for the region into it,
      // place the region into the dg scope and then load its blocks.
      var config = {
        id: id,
        attributes: { id: id }
      };
      var region = new dg.Region(config);
      for (var setting in regions[id]) {
        if (!regions[id].hasOwnProperty(setting)) { continue; }
        region.set(setting, regions[id][setting]);
      }
      dg.regions[id] = region;
      var blocks = dg.regions[id].getBlocks();
      if (blocks.length == 0) { continue; }

      // Open the region, render the placeholder for each of its block(s), then
      // close the region.
      innerHTML += '<' + region.get('format')  + ' ' + dg.attributes(region.get('attributes')) + '>';
      for (var i = 0; i < blocks.length; i++) {
        var block = dg.blockLoad(blocks[i]);
        innerHTML += '<' + block.get('format')  + ' ' + dg.attributes(block.get('attributes')) + '>';
        innerHTML += '</' + block.get('format') + '>';
      }
      innerHTML += '</' + region.get('format') + '>';

    }
    innerHTML += dg.render(content);

    // Place the region, and block placeholders, into the app's div.
    document.getElementById('dg-app').innerHTML = innerHTML;

    // Run the build promise for each block, then inject their content as they respond.
    // Keep a tally of all the blocks, and once their promises have all completed, then
    // if there are any forms on the page, attach their UI submit handlers. We don't use
    // a promise all, so blocks can render one by one.
    var blocks = dg.blocksLoad();
    var blocksToRender = [];

    var finish = function(_block) {

      // Remove this block from the list of blocks to be rendered.
      blocksToRender.splice(blocksToRender.indexOf(_block.get('id')), 1);

      // If we're all done rendering with every block...
      if (blocksToRender.length == 0) {

        // Run any post render functions and reset the queue.
        if (dg._postRender.length) {
          for (var i = 0; i < dg._postRender.length; i++) { dg._postRender[i](); }
          dg._postRender = [];
        }

        // Process the form(s), if any.
        // @TODO form should be processed as they're injected, because waiting
        // until all promises have resolved like this means a form can't be used
        // until they've all resolved.
        var forms = dg.loadForms();
        for (var id in forms) {
          if (!forms.hasOwnProperty(id)) { continue; }
          var form_html_id = dg.killCamelCase(id, '-');
          var form = document.getElementById(form_html_id);
          function processForm(e) {
            if (e.preventDefault) e.preventDefault();
            var _form = dg.loadForm(id);
            _form._submission().then(
                function() { },
                function() { }
            );
            return false; // Prevent default form behavior.
          }
          if (form.attachEvent) { form.attachEvent("submit", processForm); }
          else { form.addEventListener("submit", processForm); }
        }
      }
    };

    for (id in blocks) {
      if (!blocks.hasOwnProperty(id)) { continue; }
      blocksToRender.push(id);
      blocks[id].getVisibility().then(function(visibility) {
        if (visibility.visible) {
          visibility.block.buildWrapper().then(function(_block) {
            var _id = dg.cleanCssIdentifier(_block.get('id'));
            var el = document.getElementById(_id).innerHTML = dg.render(_block.get('content'));
            finish(_block);
          });
        }
        else {
          dg.removeElement(dg.cleanCssIdentifier(visibility.block.get('id')));
          finish(visibility.block);
        }
      });
    }

  });
};

dg.renderProperties = function() {
  return ['_prefix', '_suffix', '_preRender', '_postRender']
};

/**
 *
 * @param content
 * @returns {*}
 * @see https://api.drupal.org/api/drupal/core!lib!Drupal!Core!Render!Element!RenderElement.php/class/RenderElement/8
 */
dg.render = function(content) {
    var type = typeof content;
    if (!content) { return ''; }
    if (type === 'string') { return content; }
    var html = '';
    var _html = null;
    if (type === 'object') {
      var prefix = content._prefix ? content._prefix : '';
      var suffix = content._suffix ? content._suffix : '';
      if (typeof content._postRender === 'undefined') { content._postRender = []; }
      if (content.markup) {
        console.log('DEPRECATED: Use "_markup" instead of "markup" in this render array:');
        console.log(content);
        content._markup = content.markup;
      }
      if (content._postRender.length) {
        for (var i = 0; i < content._postRender.length; i++) {
          dg._postRender.push(content._postRender[i]);
        }
      }
      if (content._markup) {
        return prefix + content._markup + suffix;
      }
      if (content._theme) {
        return prefix + dg.theme(content._theme, content) + suffix;
      }
      if (content._type) {
        return prefix + dg.theme(content._type, content) + suffix;
      }
      // @TODO properly handle negative weights.
      var weighted = {};
      var weightedCount = 0;
      html += prefix;
      for (var index in content) {
        if (!content.hasOwnProperty(index) || jDrupal.inArray(index, dg.renderProperties())) { continue; }
        var piece = content[index];
        var _type = typeof piece;
        if (_type === 'object' && piece !== null) {
          var weight = typeof piece._weight !== 'undefined' ? piece._weight : 0;
          if (typeof weighted[weight] === 'undefined') { weighted[weight] = []; }
          weighted[weight].push(dg.render(piece));
          weightedCount++;
        }
        else if (_type === 'array') {
          for (var i = 0; i < piece.length; i++) {
            html += dg.render(piece[i]);
          }
        }
        // @TODO this allows string to be embedded in render elements, but it breaks forms.
        //else if (_type === 'string') { html += piece; }
      }
      if (weightedCount) {
        for (var weight in weighted) {
          if (!weighted.hasOwnProperty(weight)) { continue; }
          for (var i = 0; i < weighted[weight].length; i++) {
            html += weighted[weight][i];
          }
        }
      }
      html += suffix;
    }
    else if (type === 'array') {
      for (var i = 0; i < content.length; i++) {
        html += dg.render(content[i]);
      }
    }
    return html;
};
// Proxies.
dg.token = function() { return jDrupal.token(); };
dg.restPath = function() { return jDrupal.restPath(); };
dg.path = function() { return jDrupal.path(); };
dg.commentLoad = function() {
  return jDrupal.commentLoad.apply(jDrupal, arguments);
};
dg.nodeLoad = function() {
  return jDrupal.nodeLoad.apply(jDrupal, arguments);
};
dg.userLoad = function() {
  return jDrupal.userLoad.apply(jDrupal, arguments);
};
dg.viewsLoad = function() {
  return jDrupal.viewsLoad.apply(jDrupal, arguments);
};
// @inspiration http://krasimirtsonev.com/blog/article/A-modern-JavaScript-router-in-100-lines-history-api-pushState-hash-url

dg.router = {
  routes: [],
  mode: null,
  root: '/',
  config: function(options) {
    this.mode = options && options.mode && options.mode == 'history'
    && !!(history.pushState) ? 'history' : 'hash';
    this.root = options && options.root ? '/' + this.clearSlashes(options.root) + '/' : '/';
    return this;
  },
  getFragment: function() {
    var fragment = '';
    if(this.mode === 'history') {
      fragment = this.clearSlashes(decodeURI(location.pathname + location.search));
      fragment = fragment.replace(/\?(.*)$/, '');
      fragment = this.root != '/' ? fragment.replace(this.root, '') : fragment;
    } else {
      var match = window.location.href.match(/#(.*)$/);
      fragment = match ? match[1] : '';
    }
    return this.clearSlashes(fragment);
  },
  prepFragment: function(f) {
    //var fragment = f || this.getFragment();
    var frag = f || this.getFragment();
    return this.root + frag;
  },
  clearSlashes: function(path) {
    return path.toString().replace(/\/$/, '').replace(/^\//, '');
  },
  //add: function(re, handler) {
  //  if(typeof re == 'function') {
  //    handler = re;
  //    re = '';
  //  }
  //  this.routes.push({ re: re, handler: handler });
  //  return this;
  //},
  add: function(item) {
    this.routes.push(item);
    return this;
  },
  remove: function(param) {
    for(var i=0, r; i<this.routes.length, r = this.routes[i]; i++) {
      if(r.path.toString() === param.toString()) {
        this.routes.splice(i, 1);
        return this;
      }
    }
    return this;
  },
  flush: function() {
    this.routes = [];
    this.mode = null;
    this.root = '/';
    return this;
  },

  check: function(f) {


    var route = this.load(f);
    if (route) {

      dg.removeForms();

      var matches = this.matches(f).match;

      var menu_execute_active_handler = function(content) {
        dg.content = content;
        dg.appRender();
      };

      if (!route.defaults) { route = this.load(dg.getFrontPagePath()); }

      if (route.defaults) {

        // Set the page title, which may be null.
        dg.setTitle(route.defaults._title);

        // Handle forms, apply page arguments or no arguments.
        if (route.defaults._form) {
          var id = route.defaults._form;
          if (matches.length > 1) {
            matches.shift();
            dg.addForm(id, dg.applyToConstructor(window[id], matches)).getForm().then(menu_execute_active_handler);
          }
          else {
            dg.addForm(id, new window[id]).getForm().then(menu_execute_active_handler);
          }
        }

        // All other routes, apply page arguments or no arguments.
        else {

          if (matches.length > 1) {
            matches.shift();
            route.defaults._controller.apply(null, matches).then(menu_execute_active_handler);
          }
          else {
            route.defaults._controller().then(menu_execute_active_handler);
          }

        }

      }

    }
    return this;
  },
  listen: function() {
    var self = this;
    var current = self.getFragment();
    var fn = function() {
      if(current !== self.getFragment()) {
        current = self.getFragment();
        self.check(current);
      }
    };
    clearInterval(this.interval);
    this.interval = setInterval(fn, 50);
    return this;
  },
  load: function(frag) {
    var matches = this.matches(frag);
    if (matches) { return this.routes[matches.i]; }
    return null;
  },
  matches: function(frag) {
    var f = this.prepFragment(frag);
    for(var i=0; i<this.routes.length; i++) {
      var match = f.match(this.routes[i].path);
      if (match) {
        return {
          match: match,
          i: i
        };
      }
    }
    return null;
  },
  navigate: function(path) {
    path = path ? path : '';
    if(this.mode === 'history') {
      var hPath = this.root + this.clearSlashes(path);
      history.pushState(
        null,
        null,
        hPath
      );
    } else {
      window.location.href = window.location.href.replace(/#(.*)$/, '') + '#' + path;
    }
    return this;
  },
  getRoutes: function() {
    return this.routes;
  },
  getRoute: function() {

  }
};
/**
 *
 * @constructor
 */
dg.Theme = function() {
  this.regions = null;
};
dg.Theme.prototype.get = function(property) {
  return typeof this[property] !== 'undefined' ? this[property] : null;
};
dg.Theme.prototype.getRegions = function() {
  return this.get('regions');
};

dg.themeLoad = function() {
  return new Promise(function(ok, err) {
    if (!dg.activeTheme) {
      var themeClassName = jDrupal.ucfirst(dg.getCamelCase(dg.config('theme').name));
      if (!window[themeClassName]) {
        var msg = 'Failed to load theme (' + themeClassName + ') - did you include its .js file in the index.html file?';
        err(msg);
        return;
      }
      dg.activeTheme = new window[themeClassName];
    }
    ok(dg.activeTheme);
  });
};

/**
 * Implementation of theme().
 * @param {String} hook
 * @param {Object} variables
 * @return {String}
 */
dg.theme = function(hook, variables) {
  try {

    // If there is HTML markup present, just return it as is. Otherwise, run
    // the theme hook and send along the variables.
    if (!variables) { variables = {}; }
    if (variables._markup) { return variables._markup; }
    var content = '';

    // First see if the current theme implements the hook, if it does use it, if
    // it doesn't fallback to the core theme implementation of the hook.
    //var theme_function = drupalgap.settings.theme + '_' + hook;
    //if (!function_exists(theme_function)) {
      var theme_function = 'theme_' + hook;
      if (!jDrupal.functionExists(dg[theme_function])) {
        var caller = null;
        if (arguments.callee.caller) {
          caller = arguments.callee.caller.name;
        }
        var msg = 'WARNING: ' + theme_function + '() does not exist.';
        if (caller) { msg += ' Called by: ' + caller + '().' }
        console.log(msg);
        return content;
      }
    //}

    // Set default properties.
    if (!variables._attributes) { variables._attributes = {}; }

    // If there is no class name array, set an empty one.
    if (!variables._attributes['class']) { variables._attributes['class'] = []; }

    var html = dg[theme_function].call(null, variables);
    if (html instanceof Promise) {
      html.then(function(data) {
        document.getElementById(data.variables._attributes.id).innerHTML = dg.render(data.content);
      });
      return '<div ' + dg.attributes(variables._attributes) + '></div>';
    }
    return html;
  }
  catch (error) { console.log('dg.theme - ' + error); }
};
dg.currentUser = function() { return jDrupal.currentUser(); };
dg.userPassword = function() { return jDrupal.userPassword.apply(jDrupal, arguments); };
dg.theme_view = function(variables) {
  if (!variables._attributes.id) {
    var msg = 'WARNING: dg.theme_view - no attribute id was provided, so a ' +
      'random one was generated for the following View widget: ' +
      dg.restPath() + variables._path;
    console.log(msg);
    variables._attributes.id = dg.userPassword();
  }
  return new Promise(function(ok) {
    jDrupal.viewsLoad(variables._path).then(function(data) {
      var format = variables._format ? variables._format : 'div';
      var attrs = variables._format_attributes ? variables._format_attributes : null;
      var content = '<' + format + ' ' + dg.attributes(attrs) + '>';
      if (data.results.length > 0) {
        for (var i = 0; i < data.results.length; i++) {
          var open, close = '';
          switch (format) {
            case 'ul':
            case 'ol':
              open = '<li>';
              close = '</li>';
              break;
            case 'table':
              open = '<tr>';
              close = '</tr>';
              break;
            default: break;
          }
          content += open + variables._row_callback(data.results[i]) + close;
        }
      }
      content += '</' + format + '>';
      ok({
        variables: variables,
        content: content
      });
    });
  });
};
/**
 * Implementation of theme_link().
 * @param {Object} variables
 * @return {String}
 */
dg.theme_link = function(variables) {
  var text = variables._text ? variables._text : '';
  var path = variables._path;
  if (path == '') { path = dg.getFrontPagePath(); }
  if (typeof variables._attributes.href === 'undefined' && path) { variables._attributes.href = '#' + path; }
  return '<a ' + dg.attributes(variables._attributes) + '>' + text + '</a>';
};

dg.theme_image = function(vars) {
  vars._attributes.src = vars._attributes.src ? vars._attributes.src : vars._path;
  var src = vars._attributes.src;
  if (src && src.indexOf('public://') != -1 || src.indexOf('private://') != -1) {
    vars._attributes.src = dg.imagePath(src);
  }
  vars._attributes.alt = vars._attributes.alt ? vars._attributes.alt : vars._alt;
  vars._attributes.title = vars._attributes.title ? vars._attributes.title : vars._title;
  return '<img ' + dg.attributes(vars._attributes) + '/>';
};

/**
 * Implementation of theme_item_list().
 * @param {Object} variables
 * @return {String}
 */
dg.theme_item_list = function(variables) {
  var html = '';
  var type = variables._type ? variables._type : 'ul';
  if (variables._title) { html += '<h2>' + variables._title + '</h2>'; }
  html += '<' + type + ' ' + dg.attributes(variables._attributes) + '>';
  if (variables._items && variables._items.length > 0) {
    for (var i in variables._items) {
      if (!variables._items.hasOwnProperty(i)) { continue; }
      var item = variables._items[i];
      var attrs = {};
      if (i == 0) { attrs['class'] = ['first']; }
      else if (i == variables._items.length - 1) { attrs['class'] = ['last']; }
      html += '<li ' + dg.attributes(attrs) + '>' + item + '</li>';
    }
  }
  return html += '</' + type + '>';
};

dg.modules.admin = new dg.Module();

dg.modules.admin.blocks = function() {
  var blocks = {};
  blocks.admin_menu = {
    build: function () {
      return new Promise(function(ok, err) {
        var content = {};
        content['menu'] = {
          _theme: 'item_list',
          _items: [
            dg.l(dg.theme('image', { _path: 'favicon.ico' }), ''),
            dg.l('Content', 'node/add'),
            dg.l('My account', 'user/' + dg.currentUser().id()),
            dg.l('Logout', 'user/logout')
          ]
        };
        ok(content);
      });
    }
  };
  return blocks;
};
dg.modules.core = new dg.Module();

/**
 * Implements hook_rest_pre_process().
 * @param xhr
 * @param data
 */
function core_rest_pre_process(xhr, data) { dg.spinnerShow(); }

/**
 * Implements hook_rest_post_process().
 * @param xhr
 */
function core_rest_post_process(xhr) { dg.spinnerHide(); }

dg.modules.core = new dg.Module();

// Let DrupalGap know we have a FieldFormatter(s).
dg.modules.core.FieldFormatter = {};

// Number integer field formatter.
// Extend the FieldFormatter prototype for the number_integer field.
dg.modules.core.FieldFormatter.entity_reference_label = function() { dg.FieldFormatterPrepare(this, arguments); };
dg.modules.core.FieldFormatter.entity_reference_label.prototype = new dg.FieldFormatter;
dg.modules.core.FieldFormatter.entity_reference_label.prototype.constructor = dg.modules.core.FieldFormatter.entity_reference_label;
dg.modules.core.FieldFormatter.entity_reference_label.prototype.viewElements = function(FieldItemListInterface, langcode) {
  var items = FieldItemListInterface.getItems();
  var element = {};
  if (items.length == 0) { return element; }
  for (var delta = 0; delta < items.length; delta++) {
    element[delta] = {
      _theme: 'entity_reference_label',
      _item: items[delta]
    };
  }
  return element;
};

// Number integer field formatter.
// Extend the FieldFormatter prototype for the number_integer field.
dg.modules.core.FieldFormatter.number_integer = function() { dg.FieldFormatterPrepare(this, arguments); };
dg.modules.core.FieldFormatter.number_integer.prototype = new dg.FieldFormatter;
dg.modules.core.FieldFormatter.number_integer.prototype.constructor = dg.modules.core.FieldFormatter.number_integer;
dg.modules.core.FieldFormatter.number_integer.prototype.viewElements = function(FieldItemListInterface, langcode) {
  var items = FieldItemListInterface.getItems();
  var element = {};
  if (items.length == 0) { return element; }
  for (var delta = 0; delta < items.length; delta++) {
    element[delta] = {
      _theme: 'number_integer',
      _item: items[delta]
    };
  }
  return element;
};

// String field formatter.
// Extend the FieldFormatter prototype for the number_integer field.
dg.modules.core.FieldFormatter.string = function() { dg.FieldFormatterPrepare(this, arguments); };
dg.modules.core.FieldFormatter.string.prototype = new dg.FieldFormatter;
dg.modules.core.FieldFormatter.string.prototype.constructor = dg.modules.core.FieldFormatter.string;
dg.modules.core.FieldFormatter.string.prototype.viewElements = function(FieldItemListInterface, langcode) {
  var items = FieldItemListInterface.getItems();
  var element = {};
  if (items.length == 0) { return element; }
  for (var delta = 0; delta < items.length; delta++) {
    element[delta] = {
      _theme: 'string',
      _item: items[delta]
    };
  }
  return element;
};
// Let DrupalGap know we have a FieldWidget(s).
dg.modules.core.FieldWidget = {};

// Integer field.
// Extend the FieldWidget prototype for the Integer field.
dg.modules.core.FieldWidget.integer = function(entityType, bundle, fieldName, element, items, delta) {
  dg.FieldWidgetPrepare(this, arguments);
};
dg.modules.core.FieldWidget.integer.prototype = new dg.FieldWidget;
dg.modules.core.FieldWidget.integer.prototype.constructor = dg.modules.core.FieldWidget.integer;

dg.modules.core.FieldWidget.integer.prototype.form = function(items, delta, element, form, formState) {
  element._type = 'number';
  element._title = this.fieldDefinition.getLabel();
  element._title_placeholder = true;
  element._widgetType = 'FieldWidget';
  element._module = 'core';
  if (items && items[delta] !== 'undefined') {
    element._value = items[delta].value;
    element._attributes.value = element._value;
  }
};

// String field.
// Extend the FieldWidget prototype for the String field.
dg.modules.core.FieldWidget.string = function(entityType, bundle, fieldName, element, items, delta) {
  dg.FieldWidgetPrepare(this, arguments);
};
dg.modules.core.FieldWidget.string.prototype = new dg.FieldWidget;
dg.modules.core.FieldWidget.string.prototype.constructor = dg.modules.core.FieldWidget.string;

dg.modules.core.FieldWidget.string.prototype.form = function(items, delta, element, form, formState) {
  element._type = 'textfield';
  element._title = this.fieldDefinition.getLabel();
  element._title_placeholder = true;
  element._widgetType = 'FieldWidget';
  element._module = 'core';
  if (items && items[delta] !== 'undefined') {
    element._value = items[delta].value;
    element._attributes.value = element._value;
  }
};

// Let DrupalGap know we have a FormWidget(s).
dg.modules.core.FormWidget = {};

// @TODO the "items" args here should be prototypes of field-item-list-interface

// String textfield widget.
dg.modules.core.FormWidget.string_textfield = function(entityType, bundle, fieldName, element, items, delta) {
  dg.FormWidgetPrepare(this, arguments);
};
dg.modules.core.FormWidget.string_textfield.prototype = new dg.FormWidget;
dg.modules.core.FormWidget.string_textfield.prototype.constructor = dg.modules.core.FormWidget.string_textfield;
dg.modules.core.FormWidget.string_textfield.prototype.form = function(items, delta, element, form, formState) {
  element._type = 'textfield';
  element._title = this.fieldName;
  element._title_placeholder = true;
  element._widgetType = 'FormWidget';
  element._module = 'core';
  if (items && items[delta] !== 'undefined') {
    element._value = items[delta].value;
    element._attributes.value = element._value;
  }
};

// @TODO Move the bundle and entityID widgets to the entity module.

// Bundle widget.
dg.modules.core.FormWidget.bundle = function(entityType, bundle, fieldName, element, items, delta) {
  dg.FormWidgetPrepare(this, arguments);
};
dg.modules.core.FormWidget.bundle.prototype = new dg.FormWidget;
dg.modules.core.FormWidget.bundle.prototype.constructor = dg.modules.core.FormWidget.bundle;
dg.modules.core.FormWidget.bundle.prototype.form = function(items, delta, element, form, formState) {
  element._type = 'hidden';
  if (items && items[delta] !== 'undefined') {
    element._value = items[delta].value;
    element._attributes.value = element._value;
  }
};
dg.modules.core.FormWidget.bundle.prototype.valueCallback = function(items, form, formState) {
  var fakeEntity = new dg[jDrupal.ucfirst(this.get('entityType'))](null);
  return {
    name: fakeEntity.getEntityKey('bundle'),
    value: [ { target_id: this.get('bundle') } ]
  };
};

// entityID widget.
dg.modules.core.FormWidget.entityID = function(entityType, bundle, fieldName, element, items, delta) {
  dg.FormWidgetPrepare(this, arguments);
};
dg.modules.core.FormWidget.entityID.prototype = new dg.FormWidget;
dg.modules.core.FormWidget.entityID.prototype.constructor = dg.modules.core.FormWidget.entityID;
dg.modules.core.FormWidget.entityID.prototype.form = function(items, delta, element, form, formState) {
  element._type = 'hidden';
  if (items && items[delta] !== 'undefined') {
    element._value = items[delta].value;
    element._attributes.value = element._value;
  }
};

/**
 *
 * @param variables
 * @returns {string}
 * @see https://api.drupal.org/api/drupal/core!themes!stable!templates!form!container.html.twig/8
 */
dg.theme_container = function(variables) {
  return '<div ' + dg.attributes(variables._attributes) + '>' +
      dg.render(variables._children) +
      '</div>';
};
dg.theme_entity_reference_label = function(variables) {
  var item = variables._item;
  return dg.l(item.target_id, item.url.replace(dg.path(), ''));
};
dg.theme_string = function(variables) {
  return variables._item.value;
};
dg.theme_number_integer = function(variables) {
  return variables._item.value;
};
dg.modules.image = new dg.Module();
var NodeEdit = function() {

  this.entity = null;
  this.entityType = 'node';
  this.bundle = null;
  this.entityID = null;

  // Handle new and existing entities.
  if (arguments[0]) {
    if (jDrupal.isInt(arguments[0])) { this.entityID = arguments[0]; }
    else {
      this.entity = new dg[jDrupal.ucfirst(this.entityType)](null);
      this.bundle = arguments[0];
    }
  }

  var self = this;

  this.buildForm = function(form, formState) {
    return new Promise(function(ok, err) {

      var buildEntityForm = function() {

        var entityType = self.entityType;
        var bundle = self.bundle;
        var entity = self.entity;
        var entityFormMode = dg.entity_form_mode[entityType][bundle];

        form._entity = entity;
        form._entityType = entityType;
        form._bundle = bundle;

        // Place the bundle name and value as a hidden element on the form.
        form[entity.getEntityKey('bundle')] = {
          _type: 'bundle',
          _widgetType: 'FormWidget',
          _module: 'core',
          _entityType: entityType,
          _bundle: bundle,
          _value: bundle
        };

        // Place each field from the entity form mode's display onto the form.
        for (var fieldName in entityFormMode) {
          if (!entityFormMode.hasOwnProperty(fieldName)) { continue; }

          //console.log(fieldName);

          // Grab the field storage config, if any.
          var fieldStorageConfig = dg.fieldStorageConfig[entityType][fieldName];
          if (!fieldStorageConfig) {

            // There was no config, so this is probably an "extra" field, e.g. node title, uid, etc...

            var type = entityFormMode[fieldName].type;
            if (!dg.modules.core.FormWidget[type]) {
              console.log('WARNING - buildForm - There is no "' + type + '" widget in the core module to handle the "' + fieldName + '" element.');
              continue;
            }

            // Create a new field form mode.
            var FieldFormMode = new dg.FieldFormMode(entityFormMode[fieldName]);
            //console.log(FieldFormMode);

            form[fieldName] = {
              _type: type,
              _widgetType: 'FormWidget',
              _module: 'core',
              _entityType: entityType,
              _bundle: bundle,
              _fieldName: fieldName,
              _fieldFormMode: FieldFormMode,
              _weight: FieldFormMode.getWeight()
            };

          }
          else {

            // There was a field config, therefore we're dealing with a field...

            // Pull out the module in charge of the field.
            var module = fieldStorageConfig.module;

            // Make sure the module and the corresponding field widget implementation is available.
            if (!module) { continue; }
            if (!jDrupal.moduleExists(module)) {
              console.log('WARNING - buildForm - The "' + module + '" module is not present for the widget on the "' + fieldName + '" field.');
              continue;
            }
            if (!dg.modules[module].FieldWidget || !dg.modules[module].FieldWidget[fieldStorageConfig.type]) {
              console.log('WARNING - buildForm - There is no "' + fieldStorageConfig.type + '" widget in the "' + module + '" module to handle the "' + fieldName + '" field.');
              continue;
            }

            // Create a new field form mode.
            var FieldFormMode = new dg.FieldFormMode(entityFormMode[fieldName]);
            //console.log(fieldStorageConfig);
            //console.log(FieldFormMode);

            // Create the element.
            form[fieldName] = {
              _type: fieldStorageConfig.type,
              _widgetType: 'FieldWidget',
              _module: module,
              _entityType: entityType,
              _bundle: bundle,
              _fieldName: fieldName,
              _fieldFormMode: FieldFormMode,
              _weight: FieldFormMode.getWeight()
            };

          }
        }
        form.actions = {
          _type: 'actions',
          submit: {
            _type: 'submit',
            _value: 'Save',
            _button_type: 'primary'
          },
          _weight: 999
        };
        ok(form);
      };

      // If we have an entity id, load the entity and place the id as an element onto the form. Then either way, build
      // the form.
      if (self.entityID) {
        dg.nodeLoad(self.entityID).then(function(entity) {
          self.entity = entity;
          self.bundle = entity.getBundle();
          form[entity.getEntityKey('id')] = {
            _type: 'entityID',
            _widgetType: 'FormWidget',
            _module: 'core',
            _value: self.entityID
          };
          buildEntityForm();
        });
      }
      else { buildEntityForm(); }

    });
  };

  this.submitForm = function(form, formState) {
    var self = this;
    return new Promise(function(ok, err) {
      // Save the entity, then redirect to the entity page view if no form action has been set.
      var entity = new jDrupal[jDrupal.ucfirst(form._entityType)](formState.getValues());
      entity.save().then(function() {
        if (!form._action) { form._action = form._entityType + '/' + entity.id(); }
        ok();
      });
    });
  };

};
NodeEdit.prototype = new dg.Form('NodeEdit');
NodeEdit.constructor = NodeEdit;
dg.modules.node = new dg.Module();

dg.modules.node.routing = function() {
  var routes = {};
  routes["node.add.type"] = {
    "path": "/node\/add\/(.*)",
    "defaults": {
      "_form": 'NodeEdit',
      "_title": "Create content"
    }
  };
  routes["node.add"] = {
    "path": "/node\/add",
    "defaults": {
      "_controller": function() {
        return new Promise(function(ok, err) {
          var items = [];
          for (var bundle in dg.allBundleInfo.node) {
            if (!dg.allBundleInfo.node.hasOwnProperty(bundle)) { continue; }
            items.push(dg.l(dg.allBundleInfo.node[bundle].label, 'node/add/' + bundle));
          }
          var content = {};
          content['types'] = {
            _theme: 'item_list',
            _items: items
          };
          ok(content);
        });
      },
      "_title": "Create content"
    }
  };
  routes["node.edit"] = {
    "path": "/node\/(.*)\/edit",
    "defaults": {
      "_form": 'NodeEdit',
      "_title": "Node edit"
    }
  };
  routes["node"] = {
    "path": "/node\/(.*)",
    "defaults": {
      "_controller": function(nid) {
        return new Promise(function(ok, err) {

          dg.nodeLoad(nid).then(function(node) {
            dg.entityRenderContent(node).then(ok);
          });

        });
      },
      "_title": "Node"
    }
  };
  return routes;
};

dg.modules.system = new dg.Module();

dg.modules.system.routing = function() {
  var routes = {};
  routes["system.dashboard"] = {
    "path": "/dg",
    "defaults": {
      "_title": "Welcome",
      _controller: function() {
        return new Promise(function(ok, err) {
          var content = {};
          var account = dg.currentUser();

          // Show welcome message.
          var msg = 'Welcome to DrupalGap, ';
          if (account.isAuthenticated()) { msg += account.getAccountName() + '!'; }
          else { msg += dg.l('click here', 'user/login') + ' to login to your app.'; }
          content['welcome'] = { _markup: '<p>' + msg + '</p>' };

          // Add getting started info.
          content['header'] = {
            _markup: '<h2>' + dg.t('Getting started') + '</h2>'
          };

          ok(content);
        });

      }
    }
  };
  routes["system.404"] = {
    "path": "/404",
    "defaults": {
      "_title": "404 - Page not found",
      _controller: function() {
        return new Promise(function(ok, err) {
          ok('Sorry, that page was not found...');
        });

      }
    }
  };
  return routes;
};

dg.modules.system.blocks = function() {
  var blocks = {};
  blocks.main = {
    build: function () {
      return new Promise(function(ok, err) {
        ok(dg.content);
      });
    }
  };
  blocks.powered_by = {
    build: function () {
      return new Promise(function(ok, err) {
        var content = dg.t('Powered by: ') + dg.bl(
          'DrupalGap Foo', null,
          { _attributes: { href: 'http://drupalgap.org' } }
        );
        ok(content);
      });
    }
  };
  blocks.title = {
    build: function () {
      return new Promise(function(ok, err) {
        var title = dg.getTitle();
        if (typeof title === 'string') { ok({ title: { _markup: '<h1>' + dg.t(title) + '</h1>' } }); }
        else { ok(title); }
      });
    }
  };
  return blocks;
};
dg.modules.text = new dg.Module();

dg.modules.text = new dg.Module();

// Let DrupalGap know we have a FieldFormatter(s).
dg.modules.text.FieldFormatter = {};

// Text default field formatter.
// Extend the FieldFormatter prototype for the text_default field.
dg.modules.text.FieldFormatter.text_default = function() { dg.FieldFormatterPrepare(this, arguments); };
dg.modules.text.FieldFormatter.text_default.prototype = new dg.FieldFormatter;
dg.modules.text.FieldFormatter.text_default.prototype.constructor = dg.modules.text.FieldFormatter.text_default;
dg.modules.text.FieldFormatter.text_default.prototype.viewElements = function(FieldItemListInterface, langcode) {
  var items = FieldItemListInterface.getItems();
  var element = {};
  if (items.length == 0) { return element; }
  for (var delta = 0; delta < items.length; delta++) {
    element[delta] = { _markup: items[delta].value };
  }
  return element;
};
// Let DrupalGap know we have a FieldWidget(s).
dg.modules.text.FieldWidget = {};

// Text_with_summary field.
// Extend the FieldWidget prototype for the Text_with_summary field.
dg.modules.text.FieldWidget.text_with_summary = function(entityType, bundle, fieldName, element, items, delta) {
  dg.FieldWidgetPrepare(this, arguments);
};
dg.modules.text.FieldWidget.text_with_summary.prototype = new dg.FieldWidget;
dg.modules.text.FieldWidget.text_with_summary.prototype.constructor = dg.modules.text.FieldWidget.text_with_summary;

dg.modules.text.FieldWidget.text_with_summary.prototype.form = function(items, delta, element, form, formState) {
  element._type = 'textarea';
  element._title = this.fieldDefinition.getLabel();
  element._title_placeholder = true;
  element._widgetType = 'FieldWidget';
  element._module = 'text';
  if (items && items[delta] !== 'undefined') {
    element._value = items[delta].value;
  }
};
var UserLoginForm = function() {

  this.buildForm = function(form, formState) {
    return new Promise(function(ok, err) {
      form._action = dg.getFrontPagePath();
      form.name = {
        _type: 'textfield',
        _title: 'Username',
        _required: true,
        _title_placeholder: true
      };
      form.pass = {
        _type: 'password',
        _title: 'Password',
        _required: true,
        _title_placeholder: true
      };
      form.actions = {
        _type: 'actions',
        submit: {
          _type: 'submit',
          _value: 'Log in',
          _button_type: 'primary'
        }
      };
      ok(form);
    });
  };

  this.submitForm = function(form, formState) {
    var self = this;
    return new Promise(function(ok, err) {
      jDrupal.userLogin(
        formState.getValue('name'),
        formState.getValue('pass')
      ).then(ok);
    });

  };

};

// Extend the form prototype and attach our constructor.
UserLoginForm.prototype = new dg.Form('UserLoginForm');
UserLoginForm.constructor = UserLoginForm;
dg.modules.user = new dg.Module();

dg.modules.user.routing = function() {
  var routes = {};
  routes["user.login"] = {
    "path": "/user/login",
    "defaults": {
      "_form": 'UserLoginForm',
      "_title": "Log in"
    }
  };
  routes["user.logout"] = {
    "path": "/user/logout",
    "defaults": {
      "_title": "Log out",
      _controller: function() {
        return new Promise(function(ok, err) {
          ok('Logging out...');
          jDrupal.userLogout().then(function() {
            dg.goto(dg.getFrontPagePath());
          });
        });

      }
    }
  };
  routes["user"] = {
    "path": "/user\/(.*)",
    "defaults": {
      "_controller": function(uid) {
        return new Promise(function(ok, err) {

          dg.userLoad(uid).then(function(user) {
            dg.entityRenderContent(user).then(ok);
          });

        });
      },
      "_title": "user"
    }
  };
  return routes;
};
