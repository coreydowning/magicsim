﻿using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;

namespace magicsim
{
    public class SimcPreloaderData : INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler PropertyChanged;
        public event EventHandler PreloadingComplete;
        public event EventHandler PreloadingFailed;

        public string charName;

        protected void OnPropertyChanged(string name)
        {
            PropertyChangedEventHandler handler = PropertyChanged;
            if (handler != null)
            {
                handler(this, new PropertyChangedEventArgs(name));
            }
        }

        private String _Label;
        public String Label
        {
            get { return _Label; }
            set
            {
                if (value != _Label)
                {
                    _Label = value;
                    OnPropertyChanged("Label");
                }
            }
        }

        public SimcPreloaderData()
        {
            Label = "Loading /SimC Character";
        }

        public void LoadArmoryData(String simcString)
        {
            SimC simc;
            Label = "Acquiring SimC Executable";
            ThreadPool.QueueUserWorkItem((_) =>
            {
                try
                {
                    simc = SimCManager.AcquireSimC();
                }
                catch (Exception e)
                {
                    MessageBox.Show("Could not acquire SimC because of an Exception: " + e.StackTrace, "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                    App.Current.Dispatcher.Invoke(() =>
                    {
                        PreloadingFailed(this, new EventArgs());
                    });
                    return;
                }
                Label = "Generating SimC Profile";
                Regex nameRegex = new Regex("(warrior|paladin|hunter|rogue|priest|deathknight|shaman|mage|warlock|monk|druid|demonhunter)+=\"?([^\r\n\"]+)\"?");
                String name = nameRegex.Match(simcString).Groups[2].Value;
                String text = simcString + "\nsave=./characters/" + name + ".simc";
                try
                {
                    if (!Directory.Exists("characters"))
                    {
                        Directory.CreateDirectory("characters");
                    }
                    if (File.Exists("characters/" + name))
                    {
                        File.Delete("characters/" + name);
                    }
                    File.WriteAllText("characters/" + name + ".simc", text);
                }
                catch (UnauthorizedAccessException e)
                {
                    MessageBox.Show("Could not write character profile due to a permissions issue. Please retry, running as Administrator." + e.Message, "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                    App.Current.Dispatcher.Invoke(() =>
                    {
                        PreloadingFailed(this, new EventArgs());
                    });
                    return;
                }
                if (simc.RunSim("characters/" + name + ".simc"))
                {
                    Label = "SimC Profile Generated";
                    charName = name;
                    App.Current.Dispatcher.Invoke(() =>
                    {
                        PreloadingComplete(this, new EventArgs());
                    });
                }
                else
                {
                    Label = "Failed to Generate Profile";
                    MessageBox.Show("Failed to generate profile. Please check your input and try again.", "Error", MessageBoxButton.OK, MessageBoxImage.Error);

                    App.Current.Dispatcher.Invoke(() =>
                    {
                        PreloadingFailed(this, new EventArgs());
                    });
                }
            });
        }
    }
}
