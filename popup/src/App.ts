import { UltraComponent, ultraState } from "ultra-light-js";
import { world } from "./world";

export function App(){

    const [output, setOutput, subsOutput] = ultraState<string>('Nothing read yet.');

    const renderOutput = ($pre: HTMLElement) => {
        $pre.textContent = output();
    }

    const readPage = async () => {
        setOutput('Reading...');
        try {
            const page = await world.tab.page.getInfo();
            setOutput(`${page.title}\n${page.url}`);
        } catch (error) {
            setOutput(error instanceof Error ? error.message : String(error));
        }
    }

    return UltraComponent({
        component: '<div></div>',
        children: [
            UltraComponent({
                component: '<button>Read this page</button>',
                eventHandler: {
                    click: readPage
                }
            }),
            UltraComponent({
                component: '<pre></pre>',
                styles: { whiteSpace: 'pre-wrap', margin: '8px 0 0' },
                onMount: [renderOutput],
                trigger: [{
                    subscriber: subsOutput,
                    triggerFunction: renderOutput
                }]
            })
        ]
    })

}
