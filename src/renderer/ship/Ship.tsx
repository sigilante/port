import { format } from 'date-fns'
import React from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import { Link, useHistory, useParams } from 'react-router-dom'
import { send } from '../client/ipc'
import { LeftArrow } from '../icons/LeftArrow'
import { Upload } from '../icons/Upload'
import { Layout } from '../shared/Layout'
import { Spinner } from '../shared/Spinner'
import { getCometShortName } from '../shared/urbit-utils'
import { Close } from '../icons/Close'
import * as Dialog from '@radix-ui/react-dialog'
import { ShipStatus } from './components/ShipStatus'
import { LaunchButton } from './components/LaunchButton'
import { pierKey } from '../query-keys'
import { Pier } from '../../background/services/pier-service'


export const Ship: React.FC = () => {
    const history = useHistory()
    const { slug } = useParams<{ slug: string }>()
    const queryClient = useQueryClient();
    const { data: ship } = useQuery(pierKey(slug), async () => {
        const pier = await send('get-pier', slug)
        return send('check-pier', pier)
    })
    const { mutate: stopShip } = useMutation(() => send('stop-pier', ship), {
        onSuccess: (newShip: Pier) => {
            queryClient.invalidateQueries(pierKey(slug))
            queryClient.setQueryData(pierKey(slug), newShip)
        }
    })
    const { mutate: ejectShip, isLoading } = useMutation(async () => {
        const pier = await send('stop-pier', ship)

        //we wait here in case .vere.lock hasn't cleared yet (race condition)
        return new Promise<void>((resolve) => {
            setTimeout(async () => {
                await send('eject-pier', pier)
                resolve();
            }, 2000)
        })
    }, {
        onSuccess: () => {
            queryClient.prefetchQuery(pierKey())
            history.push('/')
        }
    })
    
    function onHover(ship: Pier) {
        return () => queryClient.setQueryData(pierKey(ship.slug), ship);
    }

    if (!ship) {
        return <Layout title="Loading Ship...">
            <Spinner className="h-24 w-24" />
        </Layout>
    }

    const deleteShip = async () => {
        await send('delete-pier', ship);
        history.push('/')
    }

    const formattedDate = format(new Date(ship.lastUsed), 'MM-dd-yyyy HH:mm')

    return (
        <Layout 
            title={ship.name} 
            className="pt-8 text-gray-400 dark:text-gray-500 text-sm"
            footer={
                <Link to="/" className="inline-flex items-center ml-2 mr-8 text-xs text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white focus:text-black dark:focus:text-white transition-colors">
                    <LeftArrow className="w-5 h-5 mr-2" primary="fill-current text-transparent" secondary="fill-current" />
                    Home
                </Link>
            }
        >
            <section className="w-full max-w-md mr-6">
                <div className="px-4 py-5 bg-gray-100 dark:bg-gray-900 rounded mb-8">
                    <header className="flex items-center">
                        <div className="mr-6">
                            <h1 className="font-semibold mb-1">
                                <span className="inline-block mr-2 text-xl text-black dark:text-white">{ ship.name }</span>
                                <span className="inline-block whitespace-nowrap">{ ship.type === 'comet' ? getCometShortName(ship.shipName || '') : ship.shipName }</span>
                            </h1>
                            <div className="flex items-center">
                                <ShipStatus ship={ship} />
                                {ship.status === 'running' && ship.type !== 'remote' && <button className="px-1 ml-3 font-semibold text-gray-300 dark:text-gray-700 hover:text-red-800 focus:text-red-800 hover:border-red-900 focus:border-red-900 rounded default-ring border border-gray-300 dark:border-gray-700 transition-colors" onClick={() => stopShip()}>Stop</button>}
                            </div>
                        </div>
                        <div className="ml-auto">
                            <LaunchButton ship={ship} loadData={onHover(ship)}/>
                        </div>
                    </header>
                    <hr className="my-3 border-gray-300 dark:border-gray-700"/>
                    <p className="mb-1">{ ship.directory }</p>
                    <p><span className="text-gray-700 dark:text-gray-300">Last Used: </span>{ formattedDate }</p>
                </div>
                <div className="px-4 py-5 bg-gray-100 dark:bg-gray-900 rounded">               
                    <h2 className="text-base font-semibold text-black dark:text-white mb-4">Ship Migration</h2>
                    <div className="flex items-center font-semibold">
                        { ship.type === 'remote' && 
                            <button className="button text-red-600 hover:text-red-600 focus:text-red-600 border border-red-900 hover:border-red-700 focus:border-red-700 focus:outline-none transition-colors default-ring" onClick={async () => await deleteShip()}>Remove</button>
                        }
                        { ship.type !== 'remote' &&
                            <>
                                <Dialog.Root>
                                    <Dialog.Trigger className="mr-3 hover:text-red-800 focus:text-red-800 transition-colors default-ring">
                                        Delete Permanently
                                    </Dialog.Trigger>
                                    <Dialog.Overlay className="fixed z-10 top-0 left-0 right-0 bottom-0 bg-white dark:bg-black opacity-30" />
                                    <Dialog.Content className="fixed z-40 top-1/2 left-1/2 min-w-80 bg-gray-100 dark:bg-gray-900 rounded default-ring transform -translate-y-1/2 -translate-x-1/2">
                                        <div className="relative p-4">
                                            <div className="my-6 pr-6">Are you sure you want to delete your ship's pier and data? This action is irreversible.</div>
                                            <div className="flex justify-end items-center">
                                                <Dialog.Close className="text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white focus:text-black dark:focus:text-white transition-colors mr-4 default-ring">Cancel</Dialog.Close>
                                                <Dialog.Close className="button text-red-600 hover:text-red-600 focus:text-red-600 border border-red-900 hover:border-red-700 focus:border-red-700 focus:outline-none transition-colors default-ring" onClick={async () => await deleteShip()}>Delete Permanently</Dialog.Close>
                                            </div>
                                            <Dialog.Close className="absolute top-2 right-2 text-gray-300 dark:text-gray-700 hover:text-gray-400 dark:hover:text-gray-500 focus:text-gray-400 dark:focus:text-gray-500 default-ring rounded">
                                                <Close className="w-7 h-7" primary="fill-current" />
                                            </Dialog.Close>
                                        </div>
                                        
                                    </Dialog.Content>
                                </Dialog.Root>
                                <button className="button" onClick={async () => await ejectShip()}>
                                    {!isLoading && <>
                                        <Upload className="w-5 h-5 mr-2" primary="fill-current opacity-50" secondary="fill-current" /> Eject
                                    </>}
                                    {isLoading && <>
                                        <Spinner className="w-4 h-4 mr-2" /> Ejecting
                                    </>}
                                </button>
                            </>
                        }
                    </div>
                </div>
            </section>
        </Layout>
    )
}