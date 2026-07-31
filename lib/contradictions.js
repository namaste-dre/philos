// Dashboard build, Section 3.8 (contradiction engine view) - the 42-rule
// engine, extracted VERBATIM from index.html (never hand-retyped) so this
// module cannot silently drift from the live client-side engine that
// generates report content. A parity test (lib/contradictions.test.js)
// re-extracts from index.html at test time and asserts byte-identical
// equality with the copies below - the same DI-005 drift-guard pattern
// registry-parity.test.js already uses for the axis/rule/archetype
// registries.
//
// Do not hand-edit the CONTRADICTIONS array or the two functions below.
// If index.html's contradiction engine changes, re-run the extraction
// script (documented in the Build Log entry for this module) and let the
// parity test prove the two copies match again.

'use strict';

const CONTRADICTIONS = [
  {
    id:'C01', tier:'A',
    a:'determinism', b:'justice',
    check:(d,j) => d >= 5.5 && j <= 2.5,
    title:'Hard Determinism + Desert-Based Justice',
    text:'You hold that every action is the inevitable product of prior causes - yet lean toward punishment as something people deserve. Hard determinism logically undermines the concept of moral desert: if someone could not have done otherwise, the framework of "deserving" punishment loses its grounding. Robert Sapolsky calls this the core tension of modern justice - the intellectual position is determinist, but the emotional system evolved to assign blame. The most consistent resolution: move to purely consequentialist/rehabilitative justice (punishment only justified by its effects), or adopt compatibilism (redefine freedom as acting from your own desires without external coercion).',
  },
  {
    id:'C02', tier:'A',
    a:'naturalism', b:'physicalism',
    check:(n,p) => n >= 5.5 && p <= 2.5,
    title:'Strong Naturalism + Non-Physical Mind',
    text:'You hold that everything that exists is part of the natural order - yet also hold that consciousness or mind has properties that cannot be fully captured by physical description. If everything is natural, and natural means causally governed by physical laws, a non-physical mind introduces something outside the natural order. This is one of the most philosophically active tensions in contemporary philosophy of mind. The resolution space includes property dualism (same substance, non-physical properties), panpsychism (consciousness is fundamental), or accepting physicalism fully and treating the hard problem as unsolved-but-solvable.',
  },
  {
    id:'C03', tier:'A',
    a:'realism', b:'moral_ground',
    check:(r,mg) => r <= 2.5 && mg >= 5.5,
    title:'Anti-Realism + Moral Realism',
    text:'You lean toward anti-realism - the view that facts do not exist independently of minds - yet hold strong moral realism, which claims that moral facts exist independently of minds. But moral realism is a specific instance of mind-independent facts. You cannot coherently hold that no mind-independent facts exist while simultaneously holding that mind-independent moral facts do. This often arises because anti-realism starts as a position about physical facts and people do not extend it to ethics where their intuitions are stronger. Resolution: extend anti-realism to ethics (moral constructivism), or narrow anti-realism to specific domains.',
  },
  {
    id:'C04', tier:'A',
    a:'determinism', b:'self',
    check:(d,s) => d >= 5.5 && s <= 2.5,
    title:'Hard Determinism + Authored Self',
    text:'You hold hard determinism - every decision is causally inevitable - yet lean toward a view of the self as authored and freely expressed. These assign incompatible answers to the same question. Hard determinism means the self is constituted by its causal history; the "authored self" position means the self is a genuine originating source of action. The most consistent resolutions: compatibilism (the self is real and acts freely even if determined), or accepting a fully causal account of personal identity.',
  },
  {
    id:'C05', tier:'B',
    a:'determinism', b:'responsibility',
    check:(d,r) => d >= 5.0 && r <= 3.0,
    title:'Determinism + High Personal Responsibility',
    text:'You lean toward determinism - behaviour is substantially caused by prior conditions - yet also hold strong personal responsibility, implying people are the genuine authors of their choices. These apply incompatible causal frameworks to the same question. This is one of the most common tensions in thoughtful people: the philosophical position is determinist but the emotional and practical stance retains strong responsibility intuitions. Resolution options: pragmatic responsibility (useful fiction that motivates behaviour), compatibilist responsibility (responsible for what flows from your character even if you didn’t choose your character), or weakening one position toward the other.',
  },
  {
    id:'C06', tier:'B',
    a:'meaning', b:'meaning_practice',
    check:(m,mp) => m <= 3.0 && mp <= 2.5,
    title:'Constructed Meaning + Nihilism as Practice',
    text:'You hold that meaning is constructed rather than discovered - yet your meaning practice scores toward nihilism, the view that nothing matters. These are different responses to the same starting point. If meaning is genuinely constructable, nihilism is a choice not to construct it - not a logical conclusion from meaninglessness. Camus made this distinction precisely: absurdism (construct and commit anyway) and nihilism (refuse to construct) both start from no cosmic purpose, but arrive at completely different practical orientations. The question worth sitting with: is the nihilism a philosophical position or an affective state that has been given philosophical clothing?',
  },
  {
    id:'C07', tier:'B',
    a:'determinism', b:'justice',
    check:(d,j) => d >= 5.0 && j <= 3.0,
    title:'Determinism + Punishment-Oriented Justice (Consistency Flag)',
    text:'You lean toward determinism but hold a justice orientation that still emphasises punishment as a legitimate response to harm. This is not yet a hard contradiction - compatibilism provides philosophical resources for limited accountability within a determinist framework - but the tension is real and worth examining. The question to ask: on what grounds is punishment justified if the harmful action was largely determined by prior causes? The most coherent answers involve deterrence, public safety, or rehabilitation - not desert.',
  },
  {
    id:'C08', tier:'B',
    a:'naturalism', b:'meaning',
    check:(n,m) => n >= 5.5 && m >= 5.5,
    title:'Hard Naturalism + Meaning Realism',
    text:'You hold hard naturalism - everything that exists is part of the physical natural world - yet also hold that meaning is genuinely real in a mind-independent sense. This is a philosophically demanding combination. In a purely natural world, where does objective meaning reside? It is not obviously a physical property. The most coherent naturalist positions either adopt deflationary meaning (meaning is just a pattern of psychological states with evolutionary origins) or do the explicit philosophical work of showing how natural facts ground genuine meaning (naturalised teleology, Cornell-style). The combination is not impossible but requires explicit work to resolve.',
  },
  {
    id:'C09', tier:'B',
    a:'politics', b:'economics',
    check:(p,e) => p >= 5.5 && e <= 2.5,
    title:'Structural Politics + Free Market Economics',
    text:'You hold that political outcomes are substantially determined by structural forces - systems of power and incentive - yet lean toward free market economics, which attributes economic outcomes to individual choices and merit. These apply opposite causal frameworks to the same underlying question of whether outcomes are determined by structure or individual agency. The most coherent position applies the same causal logic consistently: if structural forces shape political outcomes, they likely shape economic outcomes too. If individual agency is primary in economics, the same logic applies in politics.',
  },
  {
    id:'C10', tier:'B',
    a:'moral_scope', b:'animal_ethics',
    check:(ms,ae) => ms >= 5.5 && ae <= 2.5,
    title:'High Moral Scope + Human-Priority Animal Ethics',
    text:'You hold that the moral circle extends broadly - perhaps to future generations or all sentient beings - yet lean toward human-centric animal ethics. This creates a tension: the general principle (moral consideration extends widely) is not being applied consistently to the animal domain. The most common explanation is compartmentalisation: broad moral scope is accepted as principle but the implications for animal treatment are kept in a separate mental register. The question worth examining: on what principled grounds does the moral scope principle fail to apply to non-human animals?',
  },
  {
    id:'C11', tier:'C',
    a:'determinism', b:'progress',
    check:(d,pr) => d >= 5.5 && pr <= 2.0,
    title:'Hard Determinism + Strong Progress Pessimism (Interesting Tension)',
    text:'You hold hard determinism - outcomes are the product of prior causes - alongside strong pessimism about civilisational trajectory. This is not a logical contradiction, but it creates an interesting motivational question: if outcomes are determined and the trajectory is negative, what is the basis for action to change that trajectory? The determinist who acts to change the future is not inconsistent - they are themselves a causal factor. But the combination of determinism and pessimism can, in practice, produce passivity that the intellectual position does not actually require.',
  },
  {
    id:'C12', tier:'C',
    a:'realism', b:'identity',
    check:(r,id) => r >= 5.5 && id >= 5.5,
    title:'Strong Realism + Constructed Identity (Interesting Tension)',
    text:'You hold strong epistemic realism - facts exist independently of minds - alongside a strongly constructed view of personal identity. This is worth examining: if mind-independent facts exist about everything, are there mind-independent facts about persons? Strong social constructivism about identity holds that the self is substantially constituted by social and linguistic practices - a position that applies constructivist, not realist, logic to persons. This need not be a contradiction - social facts can be real while being mind-dependent in a different way than physical facts - but the tension deserves explicit philosophical attention.',
  },
  {
    id:'C13', tier:'A',
    a:'physicalism', b:'mind_consciousness',
    check:(ph,mc) => ph >= 5.5 && mc <= 2.5,
    title:'Physicalism + Non-Physical Consciousness',
    text:'You hold that reality is fundamentally physical - that everything that exists is constituted by physical processes - yet also hold that consciousness has properties that cannot be captured by physical description. This is the hard problem of consciousness in direct conflict with your metaphysical commitments. If physicalism is true, consciousness must be fully explicable in physical terms; if consciousness genuinely resists physical explanation, physicalism is false or incomplete. You cannot coherently hold both at strong values simultaneously without doing the philosophical work to show how they are compatible. The standard resolution paths are: eliminative materialism (deny that non-physical consciousness exists - it is an illusion), property dualism (physical substance, non-reducible mental properties), or accepting that physicalism requires revision.',
  },
  {
    id:'C14', tier:'A',
    a:'epistemic_method', b:'science',
    check:(em,sc) => em <= 2.5 && sc >= 5.5,
    title:'Revelation/Intuition Epistemology + Strong Science Trust',
    text:'You hold that revelation or intuition is the primary route to knowledge - yet also hold high trust in science as an epistemic authority. These ground knowledge in incompatible sources. Science is constitutively empirical: it derives knowledge from observation, hypothesis testing, and falsification - not revelation or intuition. To trust science highly is implicitly to endorse empirical method. The tension here is not merely academic: when scientific findings conflict with revealed or intuitive beliefs, which wins? The position requires explicit ranking. Resolution options include compartmentalisation (science for nature, revelation for meaning) with acknowledgement that this is a pragmatic division rather than a principled epistemology, or revising one of the two commitments.',
  },
  {
    id:'C15', tier:'A',
    a:'teleology', b:'naturalism',
    check:(t,n) => t >= 5.5 && n >= 5.5,
    title:'Strong Teleology + Hard Naturalism',
    text:'You hold that reality has inherent direction or purpose - that things tend toward ends - alongside hard naturalism, which holds that everything is explicable through natural, non-directed physical processes. These are in direct tension. Classical teleology (Aristotelian final causes) was explicitly rejected by the scientific revolution precisely because natural explanation does not require purposes. In a fully naturalist framework, what exists is what has been selected, not what is aimed at. This combination is not impossible - some philosophers (Nagel in "Mind and Cosmos") argue that naturalism itself requires teleological enrichment - but it demands explicit philosophical work. The easy path of holding both unreflectively produces incoherence.',
  },
  {
    id:'C16', tier:'A',
    a:'moral_authority', b:'religion',
    check:(ma,rel) => ma <= 2.0 && rel >= 5.5,
    title:'Divine Moral Authority + Atheism',
    text:"You hold that the primary source of moral authority is divine command or religious tradition - yet also hold a strongly anti-theist position on religion. This is a direct logical contradiction: divine command theory requires a divine commander, and anti-theism denies that any divine commander exists. You cannot coherently ground moral authority in a divine source you simultaneously reject. This usually arises when someone inherits a divine-command moral intuition from a religious upbringing and then loses the theological belief, without updating the metaethics. The most coherent resolutions: (1) shift your moral authority axis toward individual conscience or social contract - moral realism grounded in reason rather than revelation; (2) adopt error theory - your moral intuitions are tracking something real but the divine framing is vestigial; or (3) examine whether your anti-theism is full (no god) or merely anti-institutional (god possible, religion harmful), which may narrow the gap.",
    questions:['If no divine authority exists, what makes your moral intuitions binding rather than just preferences?','Is your anti-theism a metaphysical claim (no god exists) or a practical claim (religion causes harm) - and does that change how you ground morality?','What would you have to give up philosophically if you shifted moral authority from divine/traditional to reason-based?'],
  },
  {
    id:'C17', tier:'B',
    a:'social_ontology', b:'society',
    check:(so,soc) => so <= 2.5 && soc >= 5.5,
    title:'Individualist Ontology + Collectivist Society',
    text:'You hold that social reality is constituted by individuals - that groups and structures are reducible to the actions of persons - yet also hold a strongly collectivist view of how society should be organised. These apply inconsistent logic to the same question. If social reality is fundamentally individual, collectivist social arrangements must be understood as aggregations of individual choices - which limits their normative force. If collectivism is normatively compelling, it generally presupposes that groups and social structures have genuine independent standing. The tension is not fatal - methodological individualists can advocate for redistributive structures on purely individual-welfare grounds - but this requires explicit justification, not assumed compatibility.',
  },
  {
    id:'C18', tier:'B',
    a:'authority', b:'epistemic_humility',
    check:(auth,eh) => auth <= 2.0 && eh <= 2.5,
    title:'Authority Skepticism + Low Epistemic Humility',
    text:'You hold a strongly skeptical position toward authority - resisting deference to institutions, tradition, or expertise - alongside low epistemic humility, meaning you are confident in your own assessments. This combination is worth examining carefully. Skepticism of authority is most coherent when paired with genuine uncertainty - the recognition that established views may be wrong, but so might yours. When skepticism of authority is paired with high confidence in personal judgment, it can function not as principled epistemic independence but as a self-exemption from the same scrutiny applied to others. The most consistent position applies equal epistemic standards to both institutional claims and personal beliefs.',
  },
  {
    id:'C19', tier:'B',
    a:'human_nature', b:'responsibility',
    check:(hn,r) => hn >= 5.5 && r >= 5.5,
    title:'Universal Human Nature + Structural Responsibility',
    text:'You hold that human nature is fixed and universal - there are stable, essential features of persons - yet also hold that outcomes are primarily explained by structural forces rather than individual choices. These apply competing causal logics. If human nature is fixed, variation in outcomes across individuals and societies must be explained by something other than nature - which points toward structure. This is actually more consistent than it might appear: a fixed human nature in different structural environments could produce radically different outcomes. But the tension arises at the level of responsibility: if nature is fixed and structure is primary, individual responsibility for outcomes becomes difficult to ground. The position requires explicit articulation of where individual agency enters the causal chain.',
  },
  {
    id:'C20', tier:'B',
    a:'knowledge', b:'epistemic_method',
    check:(kn,em) => Math.abs(kn - em) >= 3.0,
    title:'Knowledge Source / Epistemic Method Misalignment',
    text:'Your applied knowledge source and your stated epistemic method are pointing in significantly different directions. This is a common and important gap: people often endorse empiricism at the level of abstract principle while actually relying on intuition, testimony, or revealed authority in practice - or vice versa. The question is not which one is right, but which one is actually governing your beliefs. Genuine intellectual coherence requires that the method you endorse and the method you use converge. When they do not, your stated epistemology is a performance rather than an operating system.',
  },
  {
    id:'C21', tier:'B',
    a:'ethics', b:'justice',
    check:(eth,j) => eth >= 5.5 && j <= 2.5,
    title:'Consequentialist Ethics + Desert-Based Justice',
    text:"You hold a broadly consequentialist ethical framework - the rightness of an action is determined by its outcomes - yet lean toward desert-based, retributive justice, which holds that punishment is warranted by what someone deserves for past choices, regardless of future effects. These are in direct tension. Consequentialism cares only about producing good outcomes going forward; retributive justice is backward-looking, anchored in what happened rather than what punishment will achieve. A pure consequentialist has no grounds for punishment that does not prevent future harm or deter future wrongdoing. The combination often arises because the emotional pull of retributive justice is very strong even in people who endorse consequentialism as an abstract principle. The consistent consequentialist position is rehabilitative or deterrence-based justice only - punishment justified solely by the good it produces, not by what the offender deserves.",
    questions:['If a punishment produces no deterrent effect and no rehabilitation - if it simply makes the offender suffer - do you believe it is still justified?','Can you articulate what "deserving" punishment means without reference to free will and past choices?','Would you support a justice system that produced better social outcomes through approaches you found personally unsatisfying?'],
  },
  {
    id:'C22', tier:'B',
    a:'temporal_orientation', b:'progress',
    check:(to,pr) => to <= 2.5 && pr >= 5.5,
    title:'Past Authority + Progress Optimism',
    text:'You hold that past authority, tradition, or established norms are a primary reference point - yet also hold strong optimism about civilisational progress and improvement. These point in opposite directions. Reverence for past authority typically implies that inherited wisdom is the most reliable guide - which limits how much improvement is possible without abandoning established frameworks. Strong progress optimism implies that better arrangements are available ahead - which tends to require revising rather than preserving inherited structures. This combination is not impossible (a traditionalist who believes tradition is itself progressivist), but requires explicit articulation of how tradition and improvement are understood to be compatible.',
  },
  {
    id:'C23', tier:'B',
    a:'uncertainty', b:'epistemic_humility',
    check:(unc,eh) => unc <= 2.5 && eh <= 2.5,
    title:'Low Uncertainty Tolerance + Low Epistemic Humility',
    text:'You have both low tolerance for uncertainty - preferring resolved positions over open questions - and low epistemic humility - high confidence in your own assessments. This combination is worth flagging not as a logical contradiction but as a psychological profile with known failure modes. High confidence combined with discomfort with ambiguity tends to produce premature closure: positions adopted and defended before sufficient evidence is available, because the discomfort of not knowing exceeds the discomfort of being wrong. The most intellectually rigorous position holds uncertainty tolerance and epistemic calibration together - confidence proportioned to evidence, with genuine comfort in saying "I do not know yet."',
  },
  {
    id:'C24', tier:'B',
    a:'economics', b:'society',
    check:(eco,soc) => eco <= 2.5 && soc <= 2.5,
    title:'Free Market Economics + Individualist Society',
    text:'You hold both free market economics and individualist social organisation. These are mutually reinforcing positions, but together they produce a coherent worldview with a specific and important blind spot: collective action problems. Markets and individual freedom both perform well when individual choices aggregate into beneficial outcomes. They perform badly when individually rational choices produce collectively harmful outcomes - pollution, arms races, public goods underproduction, coordination failures. The combination of both positions without a mechanism for collective action creates systematic vulnerability to exactly these problems. The question is not whether this combination is internally consistent (it is), but whether it is complete.',
  },
  {
    id:'C25', tier:'A',
    a:'freewill_practice', b:'determinism',
    check:(fwp,det) => fwp <= 2.5 && det >= 5.5,
    title:'Hard Determinism + Full Accountability Practice',
    text:"You hold hard determinism at the theoretical level - every action is the inevitable product of prior causes, and no one could have done otherwise. Yet your practical orientation toward free will is strongly accountability-based: you treat people as genuine originators of their choices, deserving credit or blame. This is not a minor tension. It is a direct logical contradiction between two claims about the same phenomenon. Robert Sapolsky calls this the defining incoherence of modern moral culture: the intellectual position is determinist, but the emotional and practical system assigns full agency. The contradiction is especially sharp because you score strongly on both axes, not ambivalently on one. The most coherent resolutions: (1) adopt compatibilism - redefine free will as acting from your own desires without external coercion, which allows both positions; (2) move your practical stance toward structural/rehabilitative framing of responsibility; or (3) commit to soft determinism and lower your theoretical determinism score. Most people resist all three because the accountability system is evolutionarily ancient and emotionally entrenched. Knowing that does not dissolve the contradiction.",
    questions:['Can you justify holding someone responsible for an action they could not have avoided given the prior state of their brain and the world?','What is the difference between punishment that serves a social function and punishment that someone deserves?','If you learned tomorrow that a person\'s harmful action was entirely caused by factors outside their control - genetics, upbringing, neurology - would your sense of their responsibility change?'],
  },
  {
    id:'C26', tier:'C',
    a:'religion', b:'meaning',
    check:(rel,m) => rel >= 5.5 && m <= 2.5,
    title:'Faith-Positive Religion + Constructivist Meaning (Interesting Tension)',
    text:'You hold a faith-positive orientation toward religion alongside a constructivist view of meaning - the position that meaning is made rather than discovered. This combination is worth examining because most religious traditions ground meaning in discovery: meaning is real, given, and waiting to be apprehended through faith and practice. A constructivist who is faith-positive is choosing a religious orientation for reasons other than metaphysical conviction - perhaps community, ritual, aesthetic experience, or moral framework. That is a coherent position, but it is a substantially different relationship to religious tradition than the tradition itself typically demands. Worth asking: what is the actual function of religious commitment in your meaning-making?',
  },
  {
    id:'C27', tier:'C',
    a:'moral_ground', b:'ethics',
    check:(mg,eth) => mg <= 2.5 && eth <= 2.5,
    title:'Anti-Realist Moral Ground + Deontological Ethics (Interesting Tension)',
    text:'You hold moral anti-realism - moral facts are not mind-independent - alongside a deontological ethical framework that treats certain actions as intrinsically right or wrong regardless of consequences. Classical deontology (Kant, Ross) was typically grounded in claims about objective moral reality or rational necessity - the idea that some duties are real independently of what anyone prefers. Anti-realist deontology is possible - Korsgaard constructs deontological obligations from the structure of practical reason - but it is philosophically demanding. The tension worth examining: if moral facts are not mind-independent, what gives deontological rules their categorical force? "Wrong regardless of consequences" needs a grounding that anti-realism makes harder to supply.',
  },
  {
    id:'C28', tier:'C',
    a:'self', b:'identity',
    check:(s,id) => s <= 2.0 && id <= 2.0,
    title:'Authored Self + Essential Identity (Interesting Tension)',
    text:'You hold a strongly authored view of the self - the self as a free, originating source of choices - alongside a strongly essentialist view of identity - that there is a fixed nature or essence to who you are. These are in gentle tension: the authored self emphasises radical freedom to constitute oneself through choices, while essentialist identity implies a nature that precedes and constrains those choices. The question is what the self is authoring if it has a fixed essential nature. These positions can coexist if the authoring is understood as expressing and actualising a given nature rather than creating it from scratch - but this limits the scope of self-authorship considerably. Sartrean authenticity (existence precedes essence) sits at one pole; Aristotelian eudaimonia (actualise your given nature) at the other.',
  },
  // ── MIRROR RULES - bidirectional coverage ──
  // Each mirrors an existing rule in the opposite directional check

  {id:'C01b', tier:'C',
   a:'determinism', b:'justice',
   check:(d,j) => j <= 2.0 && d <= 4.5,
   title:'Retributive Justice and the Grounds of Desert',
   text:'You hold a strongly desert-based view of justice: people should get what they are owed for the choices they have made. This is a coherent classical position, especially when paired with a libertarian view of free will, where genuine choice grounds genuine desert. What is worth examining is what does the grounding work on your view. If people could truly have done otherwise, desert follows naturally. If choices are substantially shaped by genetics, upbringing, and circumstance, desert needs a different foundation, such as the compatibilist idea that people answer for what flows from their own character. This is not a contradiction in your thinking. It is one of the oldest open questions in the philosophy of punishment, and your answers place you at the center of it.',
   questions:[
     'What grounds desert on your view: the ability to have done otherwise, ownership of your own character, or something else?',
     'Would learning that someone had a severely deprived or abusive upbringing change how much punishment you think they deserve?',
     'Is there any finding about how choices are caused that would soften your view of desert, or is desert independent of that question?',
   ]},

  {id:'C02b', tier:'A',
   a:'naturalism', b:'physicalism',
   check:(n,p) => p >= 5.5 && n <= 2.5,
   title:'Strong Physicalism + Supernatural Worldview',
   text:'You hold that everything that exists is constituted by physical processes - yet also hold that reality includes supernatural elements beyond the physical order. These are directly contradictory. Physicalism is the claim that physical processes are all there is - no supernatural entities, forces, or interventions that operate outside physical law. A supernatural worldview holds that some aspects of reality are not explicable by physical processes. You cannot hold both simultaneously without redefining one of them beyond recognition. Resolution requires choosing: either the supernatural elements you accept are reinterpreted as natural (appearing supernatural only due to incomplete knowledge), or physicalism is weakened to something like "physical processes are primary" rather than exhaustive.',
   questions:[
     'What specifically do you mean by "supernatural" - and is it possible that what you have in mind is actually within the scope of a future physical account?',
     'If physicalism is true, what happens to the supernatural elements you accept?',
     'Can you hold that physical processes are primary without claiming they are all there is?',
   ]},

  {id:'C06b', tier:'B',
   a:'meaning', b:'meaning_practice',
   check:(m,mp) => m >= 5.5 && mp <= 2.5,
   title:'Objective Meaning Realism + Nihilist Practice',
   text:'You hold that meaning is objectively real - that some things genuinely matter independently of what anyone thinks about them - yet your practical orientation toward meaning scores toward nihilism, as if nothing matters. This is a more acute tension than its reverse: if meaning is not just constructed but genuinely real, nihilism is not a coherent resting place but a failure to engage with something that exists. You are, on this combination, committed to the existence of something you are practically refusing to engage with. The question worth examining: is the nihilist practice a philosophical position, an affective state - depression, exhaustion, alienation - or a failure to connect an abstract belief about objective meaning to any concrete content?',
   questions:[
     'If you believe meaning is objectively real, what specific things do you believe carry genuine meaning - and are you engaging with them?',
     'Is your practical nihilism a considered philosophical position or does it feel more like a mood or emotional state?',
     'What would it look like to actually live as if objective meaning were real?',
   ]},

  {id:'C08b', tier:'C',
   a:'naturalism', b:'meaning',
   check:(n,m) => n <= 2.5 && m <= 2.5,
   title:'Supernatural Worldview + Meaning Nihilism (Interesting Tension)',
   text:'You hold a supernatural or non-naturalist view of reality - that not everything is explicable through physical processes - yet also hold that meaning is absent or constructed rather than given. Most supernatural worldviews - religious traditions, spiritual frameworks, animist ontologies - ground meaning precisely in the non-natural: in divine purpose, cosmic significance, or participation in a reality larger than the physical. A supernatural worldview without meaning realism is philosophically unusual. It suggests either that you hold a supernatural ontology without accepting its meaning implications, or that the supernatural elements of your worldview are not the kind that typically generate purpose. Worth examining what your non-natural commitments actually consist in.',
   questions:[
     'What do the supernatural elements of your worldview actually consist in - and do they carry any implications for meaning or purpose?',
     'Is it possible that your supernatural commitments and your meaning nihilism are operating in separate mental registers that have not been brought into contact?',
     'What would a supernatural worldview that genuinely entailed nihilism look like - and is that actually your position?',
   ]},

  {id:'C09b', tier:'B',
   a:'politics', b:'economics',
   check:(p,e) => p <= 2.5 && e >= 5.5,
   title:'Individualist Politics + Redistributive Economics',
   text:'You hold a strongly individualist or market-oriented political philosophy - one that prioritises individual freedom, limited state, and personal responsibility - yet lean toward redistributive economics, which requires significant collective mechanisms and state intervention to function. These apply inconsistent frameworks to the same underlying question of how social outcomes should be organised. Individualist political philosophy generally entails market economics as its natural expression. Redistributive economics generally entails collective political mechanisms. Holding both requires explicit justification: on what grounds is economic redistribution compatible with political individualism? The most coherent versions involve market-based redistribution mechanisms (negative income tax, UBI) that achieve redistribution through market mechanisms rather than collective political power.',
   questions:[
     'What specifically drives your preference for redistribution - and can that goal be achieved without the collective political mechanisms you resist?',
     'If the state should be limited in political matters, on what grounds should it be more active in economic ones?',
     'Is the tension between your political and economic positions something you have explicitly thought through, or has it not come into focus before?',
   ]},

  {id:'C10b', tier:'B',
   a:'moral_scope', b:'animal_ethics',
   check:(ms,ae) => ms <= 2.5 && ae >= 5.5,
   title:'Human-Priority Moral Scope + High Animal Ethics Weight',
   text:'You hold that the moral circle is primarily or exclusively human - that human interests substantially outweigh non-human interests - yet assign high moral weight to animal ethics, treating animal suffering as carrying genuine moral force. These can sit together, but only under real pressure. High animal ethics weighting is a claim that animals are serious moral patients within your framework; human-priority scope is a claim that they matter far less. The pairing is coherent if one principle grounds it, that suffering counts wherever it occurs, weighted by degree, and the live question is whether you apply that principle consistently or whether one of the two commitments is really doing the work.',
   questions:[
     'What is it about animals that makes their suffering carry moral weight - and does that same feature not apply across your moral scope?',
     'Can you articulate a principled reason why human interests take priority that does not also justify ignoring animal suffering entirely?',
     'If you had to choose between your moral scope position and your animal ethics position, which reflects your deeper commitments?',
   ]},

  {id:'C12b', tier:'C',
   a:'realism', b:'identity',
   check:(r,id) => r <= 2.5 && id <= 2.5,
   title:'Anti-Realist Epistemics + Essential Fixed Identity (Interesting Tension)',
   text:'You hold that reality is substantially mind-constructed - that facts do not exist independently of frameworks, perspectives, or practices - yet also hold an essentialist view of personal identity: that there is a fixed nature to who you are that precedes social construction. These apply inconsistent logic to the same question of independence from minds and practices. Anti-realism applied consistently would extend to persons: what we are is substantially constituted by social practices, language, and relationships rather than fixed in advance. The tension is not fatal - some philosophers hold anti-realism about the external world while retaining a robust account of personal identity - but it requires explicit work to show why the constructivist logic stops at the boundary of the self.',
   questions:[
     'Why does the constructivist logic you apply to external reality not extend to personal identity?',
     'What is the fixed essential nature you believe you have - and what is its status if reality is mind-constructed?',
     'Is there a coherent position that combines anti-realism about the world with essentialism about persons?',
   ]},

  {id:'C14b', tier:'B',
   a:'epistemic_method', b:'science',
   check:(em,sc) => em >= 5.5 && sc <= 2.5,
   title:'Empiricist Epistemology + Science Skepticism',
   text:'You hold that empirical evidence and observation are the primary routes to reliable knowledge - yet maintain significant skepticism toward science as an institution and epistemic authority. This is a meaningful tension: science is the most rigorous systematic embodiment of empirical method humanity has developed. Endorsing empiricism while distrusting science suggests either that you believe science is not actually following empirical principles - a concern about replication crises, institutional bias, or funding pressures - or that your empiricism is an abstract commitment that does not translate into trust in its institutional expression. The distinction matters: if your concern is methodological failures within science, the solution is better science, not science skepticism. If your concern is that current science is structurally compromised, you need an account of what genuine empirical inquiry would look like.',
   questions:[
     'What specifically drives your skepticism toward science - methodology, institutional incentives, specific findings, or something else?',
     'If not science, what institutions or practices do you trust to embody empirical method reliably?',
     'Is your concern that science is failing to be empirical enough - or that empiricism itself has limits?',
   ]},

  {id:'C16b', tier:'A',
   a:'moral_authority', b:'religion',
   check:(ma,rel) => ma >= 5.5 && rel <= 2.5,
   title:'Divine Moral Authority + Anti-Theism',
   text:'You hold that the primary source of moral authority is divine command or sacred tradition - yet hold a strongly anti-theist position, rejecting or actively opposing theism. These are directly contradictory: divine command theory requires a divine commander. If no god exists, or if theism is actively harmful, the divine command framework for moral authority has no foundation. This combination appears most often in people who retain the moral authority structure of a religious upbringing - the sense that right and wrong are handed down from above - while abandoning the theological claims that made that structure coherent. Resolution requires either finding a non-divine ground for moral authority (reason, nature, social contract) or revising the anti-theism toward agnosticism to preserve some grounding for the authority structure.',
   questions:[
     'If no god exists, what does your sense of divine moral authority actually ground out in?',
     'Is the authority structure you retained from religious formation something you actually endorse on reflection, or a habit of mind that has not been examined?',
     'What would a fully non-divine account of the moral authority you feel actually look like?',
   ]},

  {id:'C17b', tier:'B',
   a:'social_ontology', b:'society',
   check:(so,soc) => so >= 5.5 && soc <= 2.5,
   title:'Collectivist Ontology + Individualist Social Preference',
   text:'You hold that social reality is genuinely structural - that groups, institutions, and social forces have independent standing and causal power that cannot be reduced to individual actions - yet prefer individualist social arrangements, emphasising personal freedom over collective provision and limiting collective organisation. These apply inconsistent logic. If social structures are real and causally powerful, individualist social arrangements do not make them disappear - they simply leave structural forces unaccountable and ungoverned. The case for collective social organisation is strongest precisely when you accept a holist social ontology: if structures are real and powerful, they should be deliberately shaped rather than left to operate without democratic accountability. The tension worth examining: why accept structural causal power while preferring that those structures remain ungoverned?',
   questions:[
     'If structural forces are real and causally powerful, who governs them under your preferred individualist arrangements?',
     'Is your individualist social preference driven by distrust of specific collective mechanisms, or a principled commitment to individualism?',
     'Can structural ontology be made consistent with individualist politics - and if so, how?',
   ]},

  {id:'C22b', tier:'C',
   a:'temporal_orientation', b:'progress',
   check:(to,pr) => to >= 5.5 && pr <= 2.5,
   title:'Future-Orientation + Progress Pessimism (Interesting Tension)',
   text:'You are oriented toward the future - you look to what could be rather than what has been, and ground your values in possibility rather than precedent - yet hold significant pessimism about whether the civilisational trajectory is actually improving. This is not a logical contradiction but a motivationally significant tension. Future-orientation without progress optimism produces a particular psychological configuration: you are pointed toward a future you do not believe will be better. The question worth examining is whether this is pessimism about the direction things are going (things are getting worse and need to be changed - which is motivating) or pessimism about what is possible (things cannot get substantially better - which tends toward paralysis). The first is a diagnosis; the second is a verdict.',
   questions:[
     'Is your pessimism about trajectory (things are heading in the wrong direction) or about possibility (things cannot substantially improve)?',
     'What would have to change for your progress pessimism to shift - and do you believe those changes are possible?',
     'How does your future-orientation actually function given your pessimism - what are you oriented toward if not improvement?',
   ]},

  {id:'C26b', tier:'B',
   a:'religion', b:'meaning',
   check:(rel,m) => rel <= 2.5 && m >= 5.5,
   title:'Anti-Theism + Objective Meaning Realism',
   text:'You hold a strongly anti-theist position - rejecting or actively opposing theism - yet also hold that meaning is objectively real: that some things genuinely matter independently of what anyone thinks about them. This is a philosophically demanding combination. Most robust accounts of objective meaning have historically been grounded in either divine purpose (which you reject) or natural teleology (which requires showing how natural facts generate genuine meaning without a purposive creator). Secular objective meaning realism is possible - Cornell naturalism, Aristotelian flourishing accounts, Susan Wolf’s fitting fulfilment theory - but it requires explicit philosophical work. The question worth examining: what does your objective meaning actually consist in, and what grounds it in a world without divine purpose?',
   questions:[
     'What specific things do you believe carry objective meaning - and what makes them objectively meaningful rather than merely valued by you?',
     'What grounds the objectivity of meaning in a world without divine purpose - natural facts, rational necessity, or something else?',
     'Have you encountered a secular account of objective meaning that you find compelling, or is this a position you hold without having fully worked out its foundations?',
   ]},
  {
    id:'C41', tier:'B',
    a:'physicalism', b:'meaning',
    check:(p,mn) => p >= 5.5 && mn >= 5.5,
    title:'Hard Physicalism + Meaning Realism',
    text:'You hold that the mind is entirely physical - yet also hold that meaning is genuinely real, independent of what minds construct. The challenge: in a fully physical universe, where do mind-independent meaning facts reside? Cornell naturalism offers a path (meaning facts are natural facts about flourishing), but this requires explicit philosophical work to maintain both positions coherently.',
    questions:['How do objective meaning facts fit into a fully physical description of the universe?','Is the reality of meaning grounded in something beyond what brains produce?']
  },
  {
    id:'C42', tier:'B',
    a:'epistemic_humility', b:'determinism',
    check:(eh,d) => eh >= 6.0 && d >= 6.0,
    title:'High Epistemic Humility + Strong Determinist Commitment',
    text:'You hold that genuine uncertainty is the most honest position on deep philosophical questions - yet you also hold hard determinism with significant confidence. High epistemic humility applied consistently would suggest holding determinism more tentatively, since the free will debate remains genuinely contested across philosophy of mind, neuroscience, and metaphysics.',
    questions:['Does your epistemic humility apply to your determinism as much as to other philosophical positions?','What would it take to update your confidence in determinism?']
  }
];

function contradictionStrength(rule, s1, s2) {
  const expr = rule.check.toString();
  if (expr.includes('Math.abs')) {
    const tMatch = expr.match(/([\d.]+)\s*$/);
    const threshold = tMatch ? parseFloat(tMatch[1]) : 3.0;
    const excess = Math.max(0, Math.abs(s1 - s2) - threshold);
    return Math.min(1, excess / (7 - threshold));
  }
  const params = expr.match(/\(([^)]+)\)/)[1].split(',').map(p => p.trim());
  // Find each named param's own comparison operator + threshold, wherever it sits in the text.
  function findCond(varName) {
    const re = new RegExp(varName + '\\s*(>=|<=)\\s*([\\d.]+)');
    const m = expr.match(re);
    return m ? { op: m[1], thresh: parseFloat(m[2]) } : null;
  }
  const c0 = findCond(params[0]); // rule.a's own condition → applies to s1
  const c1 = findCond(params[1]); // rule.b's own condition → applies to s2
  if (c0 && c1) {
    function excess(score, cond) {
      if (cond.op === '>=') return Math.max(0, score - cond.thresh) / Math.max(0.1, 7 - cond.thresh);
      return Math.max(0, cond.thresh - score) / Math.max(0.1, cond.thresh);
    }
    const e0 = excess(s1, c0);
    const e1 = excess(s2, c1);
    return Math.min(1, Math.sqrt((e0 ** 2 + e1 ** 2) / 2));
  }
  return rule.check(s1, s2) ? 0.5 : 0; // fallback for any shape that doesn't parse cleanly
}

function detectContradictions(scores) {
  const results = [];
  CONTRADICTIONS.forEach(c => {
    const s1 = scores[c.a] || 4;
    const s2 = scores[c.b] || 4;
    if (c.check(s1, s2)) {
      const strength = contradictionStrength(c, s1, s2);
      results.push({ ...c, strength });
    }
  });
  // Sort by strength descending within each tier (A first, then B, then C)
  const tierOrder = { A: 0, B: 1, C: 2 };
  results.sort((a, b) =>
    tierOrder[a.tier] - tierOrder[b.tier] || b.strength - a.strength
  );
  return results;
}

// -- Dashboard Section 3.8b: resolved / new / persistent between two ------
// attempts. NOT extracted from index.html (no client-side equivalent
// exists - the live app only ever shows one completion); built here for
// the dashboard against the verbatim engine above, so its classifications
// can never disagree with what the live report showed the user at the
// time. Identity is by rule id: the same rule firing on both attempts is
// "persistent" even if its strength moved.
function diffContradictions(scoresA, scoresB) {
  const before = detectContradictions(scoresA);
  const after = detectContradictions(scoresB);
  const beforeIds = new Set(before.map(r => r.id));
  const afterIds = new Set(after.map(r => r.id));

  const tally = list => list.reduce((acc, r) => { acc[r.tier] = (acc[r.tier] || 0) + 1; return acc; }, { A: 0, B: 0, C: 0 });

  return {
    resolved: before.filter(r => !afterIds.has(r.id)),
    new: after.filter(r => !beforeIds.has(r.id)),
    persistent: after.filter(r => beforeIds.has(r.id)),
    tierCounts: { a: tally(before), b: tally(after) },
  };
}

module.exports = { CONTRADICTIONS, contradictionStrength, detectContradictions, diffContradictions };
