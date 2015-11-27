/**
 * Substitution tables are hilariously complex, due to OpenType's concept
 * of scripts, language systems, features, and lookups.
 *
 * Lookups and Features live on "heaps", with features being instructions
 * to transform one or more letters somehow, and lookups being specific
 * algorithms for performing those transforms.
 *
 * Features generally have a fixed list of lookups they might point to,
 * but (in part because there can be multiple features that do the same
 * thing, roughly) a lookup can be used by more than one feature. As
 * such, the feature:lookup relation is many-to-many.
 *
 * Scripts and language systems are a way to deal with the complexity
 * of the real world. A script models a particular writing system
 * (latin, arabic, japanese, etc, as well as the special "default")
 * and this writing system may or may not apply to more than one
 * language (latin, for instance, can be french, english, turkish,
 * vietnamese, and so on).
 *
 * As each of these language systems have different rules when it comes
 * to combining accents, forming ligatures, applying punctuation, and
 * more such things, different language systems have different feature
 * requirements, although some languages will share certain features.
 * (for instance, how to align basic punctuation like commas and full
 * stops).
 *
 * So, the language:feature relation, too, is manu-to-many.
 *
 * Finally, the script:language relation is one-to-many.
 *
 */
module.exports = function addLabelSubstitution(font, globals) {

    // step 1: add a ligature lookup. This takes a bit of work.
    //         Also note this is now just a "loose" lookup on
    //         the heap of lookups.


    // step 1a: in order to set up a "multiple letters become one letter"
    //          substitution, we need to create a GSUB "type 4" lookup, which
    //          models the "many-to-one substitution" effect.
    var lookup = font.GSUB.addLookup({ LookupType: 4 });
    var subtable = lookup.addSubTable();

    // step 1b: In order to define a substitution lookup, we need to
    //          list all the letters for which substitutions are going
    //          to be necessary. If we're going to substitute "fl" with
    //          something, as well as "etc" with something, this coverage
    //          list would be ['e', 'f'], for instance.
    var substitutions = Object.keys(globals.substitutions);

    // Construct the list of initial glyphs, which we need in order to know
    // how many LigatureSets we're building.
    var initials = substitutions.map(function(v) { return (v.split(','))[0]; });
    initials = initials.filter(function(e,pos) {
        return initials.indexOf(e) === pos;
    });

    // Then, construct the same list, but then as glyph IDs, which we need to
    // construct the coverage table:
    var initialIDs = initials.map(function(e) {
        // offset added to account for .notdef
        return globals.letters.indexOf(e) + 1;
    });
    subtable.addCoverage(initialIDs);

    // step 1c: Construct the LigatureSets that we're going to need to store
    //          all the substitution rules that share the same first glyph:
    ligatureSets = {};
    initials.sort().forEach(function(mark) {
        ligatureSets[mark] = subtable.addLigatureSet();
    });

    // step 1d: add the actual ligatures we'll be using to the set.
    substitutions.forEach(function(key) {
        var glyphs = key.split(',');

        // the start glyph, which identifies the LigatureSet
        var mark = glyphs[0];

        // the ligature set we need to work with for this substitution:
        var ligatureSet = ligatureSets[mark];

        // the single glyph we want to end up with:
        var target = globals.substitutions[key];

        //  Its corresponding glyph ID:
        var LigGlyph = globals.letters.indexOf(target) + 1; // offset to account for .notdef

        //  The sequence of glyphs that will trigger this substitution,
        //  *without* the first one, which is already specified in the
        //  coverage table, so we don't need to repeat it here:
        var Components = glyphs.slice(1).map(function(v) {
            return globals.letters.indexOf(v) + 1; // offset to account for .notdef
        });

        // The ligature table payload:
        var data = { LigGlyph: LigGlyph, Components: Components };

        // And finally, we can create this ligature's table entry
        ligatureSet.addLigatureTable(data);
    });

    // step 2: wrap this ligature lookup up in a ligature feature. Much like lookups,
    //         features are just "loose" entries on a heap of features.

    var feature = font.GSUB.addFeature({ FeatureTag: "liga", lookups: [lookup] });


    // step 3: Now we need to say which language systems this feature
    //         is actually used by. We just go with a single language
    //         system, because we only need one.

    var langSysTable = font.GSUB.makeLangSys({ features: [feature] });


    // step 4: Finally, we say which real world scripts our language system applies to.
    font.GSUB.addScript({ ScriptTag: "DFLT", LangSysTables: [langSysTable] });
    font.GSUB.addScript({ ScriptTag: "latn", LangSysTables: [langSysTable] });


    // Now, wasn't that fun? Step last: make all these bindings stick.
    font.GSUB.finalise();
};
